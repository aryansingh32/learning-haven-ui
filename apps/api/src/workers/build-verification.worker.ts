import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { supabase } from '../config/database';
import logger from '../config/logger';
import { BuildHavenService } from '../modules/build-haven/service';
import { GitHubService } from '../modules/github/github.service';
import { env } from '../config/env';
import { defaultWorkerSettings } from '../config/queue';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const deadLetterQueue = new Queue('build-verification-dlq', {
  connection: redis as any,
});

interface BuildVerificationPayload {
  repoFullName: string;
  commitHash: string;
}

async function broadcastBuild(enrollmentId: string, event: string, payload: Record<string, unknown>) {
  try {
    await supabase.channel(`build:${enrollmentId}`).send({
      type: 'broadcast',
      event,
      payload,
    });
  } catch (error) {
    logger.warn('Build broadcast failed', { enrollmentId, event, error });
  }
}

/**
 * Broadcast a single log line for live streaming to the frontend.
 * Uses a fire-and-forget pattern to avoid slowing down Docker execution.
 */
async function broadcastLogLine(enrollmentId: string, line: string) {
  try {
    await supabase.channel(`build:${enrollmentId}`).send({
      type: 'broadcast',
      event: 'log_line',
      payload: { line },
    });
  } catch {
    // Silently ignore — live logs are best-effort
  }
}

const worker = new Worker<BuildVerificationPayload>(
  'build-verification',
  async (job: Job<BuildVerificationPayload>) => {
    const enrollment = await BuildHavenService.getEnrollmentByRepo(job.data.repoFullName);
    if (!enrollment) return;

    // Check rate limit (max 20 attempts/hour)
    const allowed = await BuildHavenService.checkRateLimit(enrollment.id, 20);
    if (!allowed) {
      logger.warn('Rate limit exceeded for enrollment', { enrollmentId: enrollment.id });
      const rateLimitMsg = 'Rate limit exceeded: Maximum 20 verification runs per hour allowed. Please wait before trying again.';
      await broadcastBuild(enrollment.id, 'stage_result', {
        enrollmentId: enrollment.id,
        status: 'failed',
        output: rateLimitMsg,
        commitHash: job.data.commitHash,
      });
      await broadcastBuild(enrollment.id, 'verification_complete', {
        enrollmentId: enrollment.id,
        status: 'failed',
      });
      return;
    }

    const resolved = await BuildHavenService.resolveCurrentStage(enrollment.id);
    if (!resolved?.stage) {
      logger.warn('Could not resolve current stage for enrollment', { enrollmentId: enrollment.id });
      return;
    }

    const stage = resolved.stage as any;
    const dockerImage =
      (stage.docker_test_image as string | null) ||
      resolved.languageConfig?.docker_test_image;

    if (!dockerImage) {
      const errorMsg = 'No docker image configured for this stage or language';
      await BuildHavenService.completeStage({
        enrollmentId: enrollment.id,
        stageId: stage.id,
        userId: enrollment.user_id,
        commitHash: job.data.commitHash,
        status: 'failed',
        output: errorMsg,
        exitCode: 1,
        executionTimeMs: 0,
        structuredFeedback: { verdict: 'failed', error: errorMsg, logs_tail: errorMsg },
      });
      await broadcastBuild(enrollment.id, 'stage_result', {
        enrollmentId: enrollment.id,
        stageId: stage.id,
        stageNumber: stage.stage_number,
        status: 'failed',
        output: errorMsg,
        commitHash: job.data.commitHash,
      });
      await broadcastBuild(enrollment.id, 'verification_complete', {
        enrollmentId: enrollment.id,
        status: 'failed',
      });
      return;
    }

    const timeoutMs = Math.min(
      Math.max(Number(stage.timeout_seconds) || 120, 10),
      900
    ) * 1000;
    const expectedExitCode =
      stage.expected_exit_code !== undefined && stage.expected_exit_code !== null
        ? Number(stage.expected_exit_code)
        : 0;
    const successCriteria = (stage.success_criteria || {}) as Record<string, unknown>;
    const hints = Array.isArray(stage.hints) ? (stage.hints as string[]) : [];

    try {
      await supabase
        .from('build_enrollments')
        .update({ last_push_at: new Date().toISOString() })
        .eq('id', enrollment.id);

      await broadcastBuild(enrollment.id, 'attempt_started', {
        enrollmentId: enrollment.id,
        stageId: stage.id,
        stageNumber: stage.stage_number,
        commitHash: job.data.commitHash,
      });

      await broadcastBuild(enrollment.id, 'verification_started', {
        stageId: stage.id,
        stageNumber: stage.stage_number,
        commitHash: job.data.commitHash,
      });

      const userToken = await GitHubService.getUserToken(enrollment.user_id) || undefined;

      // ─── Live log line callback ──────────────────────────────────
      const onLogLine = (line: string) => {
        void broadcastLogLine(enrollment.id, line);
      };

      const result = await BuildHavenService.runStageVerification({
        repoFullName: job.data.repoFullName,
        commitHash: job.data.commitHash,
        stageId: stage.id,
        testCommand: stage.test_command || 'echo "No test command configured"',
        dockerImage,
        expectedExitCode,
        timeoutMs,
        successCriteria,
        hints,
        githubToken: userToken,
        onLogLine,
        randomizationConfig: stage.randomization_config || null,
      });

      await BuildHavenService.completeStage({
        enrollmentId: enrollment.id,
        stageId: stage.id,
        userId: enrollment.user_id,
        commitHash: job.data.commitHash,
        status: result.status,
        output: result.output,
        exitCode: result.exitCode,
        executionTimeMs: result.executionTimeMs,
        structuredFeedback: result.structuredFeedback,
      });

      await broadcastBuild(enrollment.id, 'stage_result', {
        enrollmentId: enrollment.id,
        stageId: stage.id,
        stageNumber: stage.stage_number,
        status: result.status,
        output: result.output,
        structuredFeedback: result.structuredFeedback,
        commitHash: job.data.commitHash,
        // Below fields power the "next stage already implemented" detection
        stage_number: stage.stage_number,
      });

      // ─── Regression testing: re-run ALL previously passed stages ──
      if (result.status === 'passed') {
        const regressionResult = await runRegressionTests({
          enrollment,
          currentStageNumber: stage.stage_number,
          repoFullName: job.data.repoFullName,
          commitHash: job.data.commitHash,
          defaultDockerImage: dockerImage,
          languageConfig: resolved.languageConfig,
          userToken,
          onLogLine,
        });

        if (!regressionResult.allPassed) {
          // A previous stage regressed — fail the submission
          await BuildHavenService.completeStage({
            enrollmentId: enrollment.id,
            stageId: regressionResult.failedStageId!,
            userId: enrollment.user_id,
            commitHash: job.data.commitHash,
            status: 'failed',
            output: regressionResult.output,
            exitCode: 1,
            executionTimeMs: regressionResult.executionTimeMs,
            structuredFeedback: {
              verdict: 'failed',
              regression: true,
              regressed_stage: regressionResult.failedStageNumber,
              logs_tail: regressionResult.output,
            },
          });
          await broadcastBuild(enrollment.id, 'stage_result', {
            enrollmentId: enrollment.id,
            stageId: regressionResult.failedStageId,
            stageNumber: regressionResult.failedStageNumber,
            status: 'failed',
            output: `[regression] Stage ${regressionResult.failedStageNumber} regressed!\n${regressionResult.output}`,
            commitHash: job.data.commitHash,
          });
          
          await broadcastBuild(enrollment.id, 'verification_complete', {
            enrollmentId: enrollment.id,
            status: 'failed',
          });
          return;
        }

        // ─── Proactive Check: Is next stage already implemented? ──
        const nextStageResult = await runNextStageCheck({
          enrollment,
          currentStageNumber: stage.stage_number,
          repoFullName: job.data.repoFullName,
          commitHash: job.data.commitHash,
          defaultDockerImage: dockerImage,
          languageConfig: resolved.languageConfig,
          userToken,
        });

        if (nextStageResult.passed) {
           await broadcastBuild(enrollment.id, 'stage_result', {
             enrollmentId: enrollment.id,
             stageId: stage.id, // Broadcast for current stage ID so UI updates appropriately
             stageNumber: stage.stage_number,
             status: 'passed',
             output: result.output,
             structuredFeedback: result.structuredFeedback,
             commitHash: job.data.commitHash,
             nextStageAlreadyImplemented: true, // Special flag for UI
           });
        }
      }

      await broadcastBuild(enrollment.id, 'verification_complete', {
        enrollmentId: enrollment.id,
        status: result.status,
      });
    } catch (error: any) {
      logger.error('Error during build verification process', error);
      const errMsg = error?.message || 'Internal build verification worker error';
      try {
        await BuildHavenService.completeStage({
          enrollmentId: enrollment.id,
          stageId: stage.id,
          userId: enrollment.user_id,
          commitHash: job.data.commitHash,
          status: 'failed',
          output: errMsg,
          exitCode: 1,
          executionTimeMs: 0,
          structuredFeedback: { verdict: 'failed', error: errMsg, logs_tail: errMsg },
        });
        await broadcastBuild(enrollment.id, 'stage_result', {
          enrollmentId: enrollment.id,
          stageId: stage.id,
          stageNumber: stage.stage_number,
          status: 'failed',
          output: errMsg,
          commitHash: job.data.commitHash,
        });
      } catch (innerErr) {
        logger.error('Failed to record error to database', innerErr);
      }
      await broadcastBuild(enrollment.id, 'verification_complete', {
        enrollmentId: enrollment.id,
        status: 'failed',
      });
    }
  },
  {
    connection: redis as any,
    concurrency: env.BUILD_WORKER_CONCURRENCY,
    ...defaultWorkerSettings,
  }
);

worker.on('failed', async (job, error) => {
  logger.error(`Build verification job ${job?.id} failed`, error);
  if (!job || job.attemptsMade < 2) return;
  await deadLetterQueue.add('failed_build_verification_job', {
    failedJobId: job.id,
    failedReason: error.message,
    stack: error.stack,
    data: job.data,
    attemptsMade: job.attemptsMade,
    failedAt: new Date().toISOString(),
  });
});

// ─── Regression Testing ─────────────────────────────────────────────
// Runs all previously completed stages to ensure current code doesn't
// break earlier functionality. Order: oldest→newest (stage 1 first).

interface RegressionParams {
  enrollment: any;
  currentStageNumber: number;
  repoFullName: string;
  commitHash: string;
  defaultDockerImage: string;
  languageConfig: any;
  userToken?: string;
  onLogLine?: (line: string) => void;
}

interface RegressionResult {
  allPassed: boolean;
  failedStageId?: string;
  failedStageNumber?: number;
  output: string;
  executionTimeMs: number;
}

async function runRegressionTests(params: RegressionParams): Promise<RegressionResult> {
  const { enrollment, currentStageNumber, repoFullName, commitHash, defaultDockerImage, languageConfig, userToken, onLogLine } = params;

  // Fetch all stages for this challenge ordered by stage_number
  const { data: allStages } = await supabase
    .from('build_stages')
    .select('*')
    .eq('program_id', enrollment.program_id)
    .eq('is_active', true)
    .lt('stage_number', currentStageNumber)  // Only stages before current
    .order('stage_number', { ascending: true });

  if (!allStages?.length) {
    // No previous stages to regress
    return { allPassed: true, output: '', executionTimeMs: 0 };
  }

  const startTime = Date.now();

  for (const prevStage of allStages) {
    const stageDockerImage =
      (prevStage.docker_test_image as string | null) ||
      languageConfig?.docker_test_image ||
      defaultDockerImage;

    const stageTimeout = Math.min(
      Math.max(Number(prevStage.timeout_seconds) || 120, 10),
      900
    ) * 1000;

    const expectedExit =
      prevStage.expected_exit_code !== undefined && prevStage.expected_exit_code !== null
        ? Number(prevStage.expected_exit_code)
        : 0;

    onLogLine?.(`[regression] Running regression test for Stage ${prevStage.stage_number}: ${prevStage.title}`);

    try {
      const result = await BuildHavenService.runStageVerification({
        repoFullName,
        commitHash,
        stageId: prevStage.id,
        testCommand: prevStage.test_command || 'echo "No test command"',
        dockerImage: stageDockerImage,
        expectedExitCode: expectedExit,
        timeoutMs: stageTimeout,
        successCriteria: prevStage.success_criteria || {},
        hints: prevStage.hints || [],
        githubToken: userToken,
        onLogLine,
      });

      if (result.status !== 'passed') {
        onLogLine?.(`[regression] ✗ Stage ${prevStage.stage_number} FAILED regression`);
        return {
          allPassed: false,
          failedStageId: prevStage.id,
          failedStageNumber: prevStage.stage_number,
          output: `Regression failure on Stage ${prevStage.stage_number} (${prevStage.title}):\n${result.output}`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      onLogLine?.(`[regression] ✓ Stage ${prevStage.stage_number} passed`);
    } catch (err: any) {
      onLogLine?.(`[regression] ✗ Stage ${prevStage.stage_number} ERROR: ${err.message}`);
      return {
        allPassed: false,
        failedStageId: prevStage.id,
        failedStageNumber: prevStage.stage_number,
        output: `Regression error on Stage ${prevStage.stage_number}: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  onLogLine?.(`[regression] All ${allStages.length} previous stages passed ✓`);
  return { allPassed: true, output: '', executionTimeMs: Date.now() - startTime };
}

// ─── Proactive Next Stage Check ─────────────────────────────────────
// Silently runs the tests for the next stage to see if the user's
// code already satisfies it. Returns true if passed, false otherwise.

async function runNextStageCheck(params: {
  enrollment: any;
  currentStageNumber: number;
  repoFullName: string;
  commitHash: string;
  defaultDockerImage: string;
  languageConfig: any;
  userToken?: string;
}): Promise<{ passed: boolean }> {
  const { enrollment, currentStageNumber, repoFullName, commitHash, defaultDockerImage, languageConfig, userToken } = params;
  const nextStageNumber = currentStageNumber + 1;
  
  if (nextStageNumber > enrollment.total_stages) {
    return { passed: false };
  }

  const { data: nextStage } = await supabase
    .from('build_stages')
    .select('*')
    .eq('program_id', enrollment.program_id)
    .eq('stage_number', nextStageNumber)
    .eq('is_active', true)
    .single();

  if (!nextStage) return { passed: false };

  const stageDockerImage =
    (nextStage.docker_test_image as string | null) ||
    languageConfig?.docker_test_image ||
    defaultDockerImage;

  const stageTimeout = Math.min(
    Math.max(Number(nextStage.timeout_seconds) || 120, 10),
    900
  ) * 1000;

  const expectedExit =
    nextStage.expected_exit_code !== undefined && nextStage.expected_exit_code !== null
      ? Number(nextStage.expected_exit_code)
      : 0;

  try {
    const result = await BuildHavenService.runStageVerification({
      repoFullName,
      commitHash,
      stageId: nextStage.id,
      testCommand: nextStage.test_command || 'echo "No test command"',
      dockerImage: stageDockerImage,
      expectedExitCode: expectedExit,
      timeoutMs: stageTimeout,
      successCriteria: nextStage.success_criteria || {},
      hints: [],
      githubToken: userToken,
      randomizationConfig: nextStage.randomization_config || null,
      // No onLogLine for proactive checks — they happen silently
    });

    return { passed: result.status === 'passed' };
  } catch {
    return { passed: false };
  }
}

export default worker;
