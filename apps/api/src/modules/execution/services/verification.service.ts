import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { EventBus, DomainEvent } from '../../core/events/EventBus';
import logger from '../../../config/logger';
import { supabase } from '../../../config/database';
import { env } from '../../../config/env';
import { buildVerificationJobOptions } from '../../../config/queue';

export interface GitHubPushPayload {
  repoFullName: string;
  commitHash: string;
  branch: string;
  enrollmentId: string;
}

const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const buildVerificationQueue = new Queue('build-verification', {
  connection: redisConnection as any,
  defaultJobOptions: buildVerificationJobOptions,
});

/**
 * VerificationService
 *
 * Owns the BullMQ build-verification queue. Subscribes to domain events
 * emitted by the github module so no other module needs to know about queuing.
 *
 * Cross-module dependency direction:
 *   github → EventBus → execution/VerificationService
 */
export class VerificationService {
  static bootstrap() {
    EventBus.subscribe<GitHubPushPayload>('github.push_received', (event: DomainEvent<GitHubPushPayload>) => {
      return VerificationService.handlePushEvent(event);
    });
    logger.info('VerificationService bootstrapped — listening for github.push_received');
  }

  private static async handlePushEvent(event: DomainEvent<GitHubPushPayload>) {
    const { repoFullName, commitHash, branch } = event.payload;
    logger.info('Enqueueing build verification', { repoFullName, commitHash, branch, requestId: event.meta.requestId });

    const { data: enrollment } = await supabase
      .from('build_enrollments')
      .select('id, user_id, build_challenge_id')
      .eq('repo_full_name', repoFullName)
      .maybeSingle();

    if (!enrollment) {
      logger.warn('No enrollment found for repo, skipping verification', { repoFullName });
      return;
    }

    await buildVerificationQueue.add(
      'verify_build',
      {
        repoFullName,
        commitHash,
        branch,
        enrollmentId: enrollment.id,
        userId: enrollment.user_id,
        challengeId: enrollment.build_challenge_id,
      },
      {
        ...buildVerificationJobOptions,
      }
    );

    logger.info('Build verification enqueued', { repoFullName, commitHash, enrollmentId: enrollment.id });
  }
}
