import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { pool, supabase as supabaseAdmin } from '../config/database';
import logger from '../config/logger';
import { ApprenticeshipCertificatesService } from '../modules/apprenticeship/certificates.service';
import { sendProjectPassedEmail } from '../services/email.service';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const VERIFY_ROOT = '/tmp/verify';
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '10', 10);

interface VerificationJobPayload {
  submissionId: string;
  userId: string;
  projectId: string;
  programId: string;
  enrollmentId: string;
  projectProgressId: string;
  repoFullName: string;
  commitHash: string;
  dockerTestImage: string;
  attemptNumber: number;
}

interface StageLine {
  stage: number;
  name: string;
  status: 'passed' | 'failed' | 'running';
  passed?: number;
  total?: number;
  xp?: number;
  error?: string;
  console_tail?: string;
}

const worker = new Worker<VerificationJobPayload>(
  'apprenticeship-verification',
  async (job: Job<VerificationJobPayload>) => {
    const workdir = path.join(VERIFY_ROOT, job.data.submissionId);
    let consoleLines: string[] = [];
    let passedTests = 0;
    let totalTests = 0;
    let totalXp = 0;
    let failedTests: Array<Record<string, unknown>> = [];

    await updateSubmission(job.data.submissionId, {
      verification_status: 'testing',
      testing_started_at: new Date().toISOString(),
    });
    await supabaseAdmin.from('apprenticeship_events').insert({
      user_id: job.data.userId,
      session_id: `verification:${job.data.submissionId}`,
      event_type: 'verification_started',
      event_category: 'verification',
      event_data: {
        attempt_number: job.data.attemptNumber,
      },
      enrollment_id: job.data.enrollmentId,
      project_id: job.data.projectId,
      submission_id: job.data.submissionId,
    });
    await broadcast(`submission:${job.data.submissionId}`, 'status_changed', {
      type: 'status_changed',
      data: { status: 'testing' },
    });

    try {
      await fs.mkdir(workdir, { recursive: true });
      await cloneExactCommit(job.data.repoFullName, job.data.commitHash, workdir);

      await logStage(job.data.submissionId, {
        stage: 0,
        name: 'Repository prepared',
        status: 'passed',
        passed: 1,
        total: 1,
        xp: 5,
      });

      const verificationResult = await streamVerificationContainer(job.data.dockerTestImage, workdir, async (stage) => {
        totalTests += stage.total || 0;
        passedTests += stage.passed || 0;
        totalXp += stage.status === 'passed' ? stage.xp || 0 : 0;

        if (stage.status === 'failed') {
          failedTests.push({
            name: stage.name,
            error: stage.error || 'Verification failed',
            expected: 'Stage passes',
            actual: 'Stage failed',
          });
        }

        if (stage.console_tail) {
          consoleLines = stage.console_tail.split('\n').slice(-20);
        }

        await logStage(job.data.submissionId, stage);
        await supabaseAdmin.from('apprenticeship_events').insert({
          user_id: job.data.userId,
          session_id: `verification:${job.data.submissionId}`,
          event_type: stage.status === 'failed' ? 'test_stage_failed' : 'test_stage_passed',
          event_category: 'verification',
          event_data: {
            stage_number: stage.stage,
            stage_name: stage.name,
            passed: stage.passed || 0,
            total: stage.total || 0,
            error: stage.error || null,
          },
          enrollment_id: job.data.enrollmentId,
          project_id: job.data.projectId,
          submission_id: job.data.submissionId,
        });
        await updateSubmission(job.data.submissionId, {
          total_tests: totalTests,
          passed_tests: passedTests,
          failed_tests: failedTests,
          xp_awarded: totalXp,
        });
        await broadcast(`submission:${job.data.submissionId}`, 'stage_result', {
          type: 'stage_completed',
          data: {
            stageNumber: stage.stage,
            stageName: stage.name,
            status: stage.status,
            xpForStage: stage.xp || 0,
            passedTests: stage.passed || 0,
            totalTests: stage.total || 0,
            error: stage.error,
            consoleTail: stage.console_tail,
          },
        });
      });

      if (verificationResult.outputTail.length > 0) {
        consoleLines = verificationResult.outputTail;
      }

      const qualityResult = await runEslintQuality(job.data.dockerTestImage, workdir);
      const securityIssues = await scanSecurityIssues(workdir);
      const verifiedAt = new Date().toISOString();
      const finalStatus = verificationResult.success ? 'passed' : 'failed';

      await updateSubmission(job.data.submissionId, {
        verification_status: finalStatus,
        total_tests: totalTests,
        passed_tests: passedTests,
        failed_tests: failedTests,
        code_quality_score: qualityResult,
        security_issues: securityIssues,
        performance_score: verificationResult.success ? 80 : 40,
        execution_time_ms: verificationResult.executionTimeMs,
        console_output_tail: consoleLines.slice(-20).join('\n'),
        verified_at: verifiedAt,
        xp_awarded: totalXp,
      });

      if (verificationResult.success) {
        await handlePassCascade(job.data, qualityResult, totalXp, verifiedAt);
        await broadcast(`enrollment:${job.data.enrollmentId}`, 'project_unlocked', {
          type: 'project_unlocked',
          data: {
            enrollmentId: job.data.enrollmentId,
            projectId: job.data.projectId,
          },
        });
      } else {
        await supabaseAdmin
          .from('apprenticeship_project_progress')
          .update({ attempts_count: job.data.attemptNumber })
          .eq('id', job.data.projectProgressId);
      }

      await supabaseAdmin.from('apprenticeship_events').insert({
        user_id: job.data.userId,
        session_id: `verification:${job.data.submissionId}`,
        event_type: verificationResult.success ? 'verification_passed' : 'verification_failed',
        event_category: 'verification',
        event_data: {
          attempt_number: job.data.attemptNumber,
          total_tests: totalTests,
          passed_tests: passedTests,
        },
        enrollment_id: job.data.enrollmentId,
        project_id: job.data.projectId,
        submission_id: job.data.submissionId,
      });

      await broadcast(`submission:${job.data.submissionId}`, 'verification_complete', {
        type: 'verification_complete',
        status: finalStatus,
      });
    } catch (error: any) {
      logger.error(`Verification failed for ${job.data.submissionId}`, error);

      if ((job.attemptsMade + 1) >= 3) {
        await updateSubmission(job.data.submissionId, {
          verification_status: 'failed',
          flagged_for_review: true,
          flag_reason: 'worker_error',
          console_output_tail: (error.message || 'Worker error').slice(0, 5000),
          verified_at: new Date().toISOString(),
        });

        await supabaseAdmin.from('apprenticeship_events').insert({
          user_id: job.data.userId,
          session_id: `verification:${job.data.submissionId}`,
          event_type: 'verification_failed',
          event_category: 'verification',
          event_data: { reason: 'worker_error', message: error.message },
          enrollment_id: job.data.enrollmentId,
          project_id: job.data.projectId,
          submission_id: job.data.submissionId,
        });
      }

      throw error;
    } finally {
      await fs.rm(workdir, { recursive: true, force: true });
    }
  },
  {
    connection: redis as any,
    concurrency: WORKER_CONCURRENCY,
    limiter: {
      max: 50,
      duration: 60000,
    },
  }
);

worker.on('failed', async (job, error) => {
  logger.error(`Verification job ${job?.id} failed: ${error.message}`);
  if (!job || job.attemptsMade < 3) return;
});

async function cloneExactCommit(repoFullName: string, commitHash: string, workdir: string) {
  await runProcess('git', ['clone', '--depth=1', `https://${process.env.GITHUB_BOT_TOKEN}@github.com/${repoFullName}`, workdir]);
  await runProcess('git', ['-C', workdir, 'fetch', '--depth=1', 'origin', commitHash]);
  await runProcess('git', ['-C', workdir, 'checkout', commitHash]);
}

async function streamVerificationContainer(
  image: string,
  workdir: string,
  onStage: (stage: StageLine) => Promise<void>
) {
  if (!image) {
    throw new Error('No docker test image configured');
  }

  const startedAt = Date.now();
  const child = spawn('docker', [
    'run',
    '--rm',
    '--network',
    'none',
    '--memory',
    '512m',
    '--cpus',
    '0.5',
    '-v',
    `${workdir}:/workspace:ro`,
    '-e',
    `SUBMISSION_ID=${path.basename(workdir)}`,
    image,
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdout = readline.createInterface({ input: child.stdout });
  const stderr = readline.createInterface({ input: child.stderr });
  const outputTail: string[] = [];

  const pushLine = (line: string) => {
    outputTail.push(line);
    if (outputTail.length > 20) outputTail.shift();
  };

  stdout.on('line', (line) => {
    pushLine(line);
    try {
      const parsed = JSON.parse(line) as StageLine;
      void onStage(parsed);
    } catch {
      // ignore non-JSON lines
    }
  });

  stderr.on('line', (line) => pushLine(line));

  const exitCode = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Docker container timeout after 120 seconds'));
    }, 120_000);

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve(code ?? 1);
    });
  });

  return {
    success: exitCode === 0,
    executionTimeMs: Date.now() - startedAt,
    outputTail,
  };
}

async function runEslintQuality(image: string, workdir: string) {
  try {
    const output = await runProcess('docker', [
      'run',
      '--rm',
      '--network',
      'none',
      '-v',
      `${workdir}:/workspace:ro`,
      '-w',
      '/workspace',
      image,
      'sh',
      '-lc',
      'if command -v eslint >/dev/null 2>&1; then eslint --format json .; else echo "[]"; fi',
    ]);

    const parsed = JSON.parse(output.stdout || '[]');
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return 75;
    }

    const totalMessages = parsed.reduce((sum: number, file: any) => sum + (file.errorCount || 0) + (file.warningCount || 0), 0);
    return Math.max(50, 100 - totalMessages * 2);
  } catch {
    return 75;
  }
}

async function scanSecurityIssues(workdir: string) {
  const issues: Array<{ type: string; message: string }> = [];
  const files = await collectFiles(workdir);

  for (const file of files) {
    if (file.endsWith('.env')) {
      issues.push({ type: 'env_file', message: `${file} should not be committed` });
    }
    const fullPath = path.join(workdir, file);
    const content = await fs.readFile(fullPath, 'utf8').catch(() => '');
    if (content.includes('eval(')) {
      issues.push({ type: 'eval_usage', message: `${file} contains eval(` });
    }
    if (content.includes('exec(')) {
      issues.push({ type: 'exec_usage', message: `${file} contains exec(` });
    }
    if (/password\s*=\s*["'][^"']{4,}["']/.test(content)) {
      issues.push({ type: 'hardcoded_password', message: `${file} contains a possible hardcoded password` });
    }
  }

  return issues;
}

async function collectFiles(root: string, relative = ''): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(root, next);
    }
    return [next];
  }));
  return nested.flat();
}

async function handlePassCascade(
  payload: VerificationJobPayload,
  codeQualityScore: number,
  xpAwarded: number,
  verifiedAt: string
) {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const progressResult = await client.query(
      `update apprenticeship_project_progress
       set status = 'passed',
           passed_at = $1,
           best_code_quality_score = greatest(coalesce(best_code_quality_score, 0), $2),
           total_xp_earned = coalesce(total_xp_earned, 0) + $3
       where id = $4
       returning enrollment_id, project_id`,
      [verifiedAt, codeQualityScore, xpAwarded, payload.projectProgressId]
    );

    const projectResult = await client.query(
      `select sort_order from apprenticeship_projects where id = $1`,
      [payload.projectId]
    );
    const currentSortOrder = projectResult.rows[0]?.sort_order;

    await client.query(
      `update apprenticeship_project_progress
       set status = 'available'
       where enrollment_id = $1
         and project_id = (
           select id from apprenticeship_projects
           where program_id = $2 and sort_order = $3 + 1
         )
         and status = 'locked'`,
      [payload.enrollmentId, payload.programId, currentSortOrder]
    );

    const enrollmentResult = await client.query(
      `update apprenticeship_enrollments
       set completed_projects = completed_projects + 1,
           progress_percentage = ((completed_projects + 1)::numeric / total_projects) * 100,
           current_project_number = current_project_number + 1
       where id = $1
       returning completed_projects, total_projects`,
      [payload.enrollmentId]
    );

    await client.query(
      `update users
       set xp = coalesce(xp, 0) + $1
       where id = $2`,
      [xpAwarded, payload.userId]
    );

    await client.query('commit');

    const enrollment = enrollmentResult.rows[0];
    if (enrollment && Number(enrollment.completed_projects) >= Number(enrollment.total_projects)) {
      await ApprenticeshipCertificatesService.generateCertificate(payload.enrollmentId);
      await broadcast(`enrollment:${payload.enrollmentId}`, 'certificate_issued', {
        type: 'certificate_issued',
        data: { enrollmentId: payload.enrollmentId },
      });
    }

    if ((progressResult.rowCount || 0) > 0) {
      await broadcast(`enrollment:${payload.enrollmentId}`, 'project_unlocked', {
        type: 'project_unlocked',
        data: { enrollmentId: payload.enrollmentId },
      });
    }

    const [{ data: user }, { data: project }, { data: nextProject }] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('full_name, email')
        .eq('id', payload.userId)
        .maybeSingle(),
      supabaseAdmin
        .from('apprenticeship_projects')
        .select('title')
        .eq('id', payload.projectId)
        .maybeSingle(),
      supabaseAdmin
        .from('apprenticeship_project_progress')
        .select(`
          apprenticeship_projects!inner (
            title
          )
        `)
        .eq('enrollment_id', payload.enrollmentId)
        .eq('status', 'available')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (user?.email) {
      await sendProjectPassedEmail({
        to: user.email,
        name: user.full_name || 'Student',
        projectTitle: project?.title || 'Project',
        xpEarned: xpAwarded,
        nextProjectTitle: (nextProject as any)?.apprenticeship_projects?.title || null,
      });
    }
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function logStage(submissionId: string, stage: StageLine) {
  const payload = {
    submission_id: submissionId,
    stage_number: stage.stage,
    stage_name: stage.name,
    status: stage.status,
    tests_in_stage: stage.total || 0,
    passed_in_stage: stage.passed || 0,
    failed_details: stage.error ? { message: stage.error, console_tail: stage.console_tail } : null,
    xp_for_stage: stage.xp || 0,
    started_at: new Date().toISOString(),
    completed_at: stage.status === 'running' ? null : new Date().toISOString(),
  };

  const { data: existing } = await supabaseAdmin
    .from('apprenticeship_test_stages')
    .select('id')
    .eq('submission_id', submissionId)
    .eq('stage_number', stage.stage)
    .maybeSingle();

  if (existing?.id) {
    await supabaseAdmin.from('apprenticeship_test_stages').update(payload).eq('id', existing.id);
    return;
  }

  await supabaseAdmin.from('apprenticeship_test_stages').insert(payload);
}

async function updateSubmission(submissionId: string, patch: Record<string, unknown>) {
  await supabaseAdmin
    .from('apprenticeship_submissions')
    .update(patch)
    .eq('id', submissionId);
}

async function broadcast(channelName: string, event: string, payload: Record<string, unknown>) {
  try {
    await supabaseAdmin.channel(channelName).send({
      type: 'broadcast',
      event,
      payload,
    });
  } catch (error) {
    logger.warn(`Broadcast failed for ${channelName}:${event}`, error);
  }
}

async function runProcess(command: string, args: string[]) {
  return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `Command failed: ${command} ${args.join(' ')}`));
      }
    });
  });
}

export default worker;
