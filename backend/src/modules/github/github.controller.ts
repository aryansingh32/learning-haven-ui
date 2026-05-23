import { Request, Response } from 'express';
import crypto from 'crypto';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { GitHubService } from './github.service';
import { supabase } from '../../config/database';
import logger from '../../config/logger';
import { fail, ok } from '../apprenticeship/http';
import { AuthRequest } from '../../middleware/auth';
import { BuildHavenController } from '../build-haven/controller';
import { resolveGitHubOAuthRedirect } from '../../utils/githubRedirect';

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const verificationQueue = new Queue('apprenticeship-verification', {
  connection: redisConnection as any,
});

export class GitHubController {
  static async getStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(fail('Unauthorized', 'E_AUTH_401'));
      }

      const { data, error } = await supabase
        .from('apprenticeship_github_connections')
        .select('github_username, is_active, connected_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        throw error;
      }

      res.json(ok({
        connected: Boolean(data),
        username: data?.github_username || null,
        connected_at: data?.connected_at || null,
      }));
    } catch (error) {
      logger.error('Error fetching GitHub connection status:', error);
      res.status(500).json(fail('Failed to fetch GitHub status', 'E_GH_503'));
    }
  }

  static async getAuthUrl(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json(fail('Unauthorized', 'E_AUTH_401'));
      }

      const returnTo = typeof req.query.return_to === 'string' ? req.query.return_to : undefined;
      const url = await GitHubService.generateOAuthUrl(userId, returnTo);
      res.json(ok({ url }));
    } catch (error) {
      logger.error('Error generating GitHub Auth URL:', error);
      res.status(500).json(fail('Failed to generate auth url', 'E_GH_501'));
    }
  }

  static async authCallback(req: Request, res: Response) {
    try {
      const { code, state } = req.query;
      if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
        return res.status(400).json(fail('Missing code or state parameters', 'E_GH_400'));
      }

      await GitHubService.handleOAuthCallback(code, state);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const storedReturn = await GitHubService.consumeOAuthReturnPath(state);
      res.redirect(resolveGitHubOAuthRedirect(storedReturn, frontendUrl, true));
    } catch (error) {
      logger.error('GitHub Auth Callback Error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const storedReturn =
        typeof req.query.state === 'string'
          ? await GitHubService.consumeOAuthReturnPath(req.query.state).catch(() => null)
          : null;
      res.redirect(resolveGitHubOAuthRedirect(storedReturn, frontendUrl, false));
    }
  }

  static async webhookReceiver(req: Request, res: Response) {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const event = req.headers['x-github-event'] as string;

      if (!signature) {
        return res.status(401).json(fail('Missing signature', 'E_GH_401'));
      }

      if (event === 'ping') {
        return res.status(200).send('pong');
      }

      const payload = req.body;
      const rawPayload =
        Buffer.isBuffer((req as any).rawBody)
          ? (req as any).rawBody
          : Buffer.from(JSON.stringify(payload || {}));
      const repoName = payload?.repository?.full_name;
      const branch = String(payload?.ref || '').replace('refs/heads/', '');
      const commitSha = payload?.after;

      const { data: buildEnrollment } = await supabase
        .from('build_enrollments')
        .select('*')
        .eq('repo_full_name', repoName)
        .maybeSingle();

      if (buildEnrollment) {
        const digest = `sha256=${crypto
          .createHmac('sha256', buildEnrollment.webhook_secret)
          .update(rawPayload)
          .digest('hex')}`;

        if (signature.length !== digest.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
          return res.status(401).json(fail('Invalid signature', 'E_GH_402'));
        }

        if (event === 'push' && branch === 'main') {
          await BuildHavenController.enqueueVerificationByRepo(repoName, commitSha);
          return res.status(200).json(ok({ received: true, mode: 'build_haven' }));
        }

        return res.status(200).json(ok({ received: true, ignored: true }));
      }

      const { data: projectProgress } = await supabase
        .from('apprenticeship_project_progress')
        .select(`
          *,
          apprenticeship_projects!inner (
            id,
            program_id,
            docker_test_image
          )
        `)
        .eq('github_repo_full_name', repoName)
        .maybeSingle();

      if (!projectProgress?.webhook_secret) {
        return res.status(404).json(fail('Repository not registered', 'E_GH_404'));
      }

      const digest = `sha256=${crypto
        .createHmac('sha256', projectProgress.webhook_secret)
        .update(rawPayload)
        .digest('hex')}`;

      if (signature.length !== digest.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        logger.warn('GitHub webhook signature mismatch');
        return res.status(401).json(fail('Invalid signature', 'E_GH_402'));
      }

      if (event !== 'push' || branch !== 'main') {
        return res.status(200).json(ok({ received: true, ignored: true }));
      }

      await supabase.from('apprenticeship_events').insert({
        user_id: projectProgress.user_id,
        session_id: `github:${repoName}:${commitSha}`,
        event_type: 'git_push_received',
        event_category: 'verification',
        event_data: {
          repo: repoName,
          branch,
          commit: commitSha,
        },
        enrollment_id: projectProgress.enrollment_id,
        project_id: projectProgress.project_id,
      });

      const { data: submission, error } = await supabase
        .from('apprenticeship_submissions')
        .insert({
          enrollment_id: projectProgress.enrollment_id,
          project_progress_id: projectProgress.id,
          user_id: projectProgress.user_id,
          project_id: projectProgress.project_id,
          github_repo_full_name: repoName,
          commit_hash: commitSha,
          learning_path: null,
          attempt_number: (projectProgress.attempts_count || 0) + 1,
          verification_status: 'pending',
        })
        .select()
        .single();

      if (error || !submission) {
        throw error || new Error('Failed to create submission');
      }

      await supabase
        .from('apprenticeship_project_progress')
        .update({ attempts_count: submission.attempt_number })
        .eq('id', projectProgress.id);

      await verificationQueue.add(
        'verify_commit',
        {
          submissionId: submission.id,
          userId: projectProgress.user_id,
          projectId: projectProgress.project_id,
          programId: projectProgress.apprenticeship_projects.program_id,
          enrollmentId: projectProgress.enrollment_id,
          projectProgressId: projectProgress.id,
          repoFullName: repoName,
          commitHash: commitSha,
          dockerTestImage: projectProgress.apprenticeship_projects.docker_test_image,
          attemptNumber: submission.attempt_number,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 30000,
          },
        }
      );

      await supabase.from('apprenticeship_events').insert({
        user_id: projectProgress.user_id,
        session_id: `verification:${submission.id}`,
        event_type: 'verification_queued',
        event_category: 'verification',
        event_data: {
          submission_id: submission.id,
          attempt_number: submission.attempt_number,
        },
        enrollment_id: projectProgress.enrollment_id,
        project_id: projectProgress.project_id,
        submission_id: submission.id,
      });

      res.status(200).json(ok({ received: true, submissionId: submission.id }));
    } catch (error) {
      logger.error('Webhook processing error:', error);
      res.status(500).json(fail('Webhook processing failed', 'E_GH_500'));
    }
  }
}
