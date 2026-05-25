import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { supabase } from '../config/database';
import logger from '../config/logger';
import { BuildHavenService } from '../modules/build-haven/service';
import { GitHubService } from '../modules/github/github.service';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
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
      });

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
    concurrency: parseInt(process.env.BUILD_WORKER_CONCURRENCY || '5', 10),
  }
);

worker.on('failed', (job, error) => {
  logger.error(`Build verification job ${job?.id} failed`, error);
});

export default worker;
