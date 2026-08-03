import { Worker } from 'bullmq';
import redis from '../config/redis';
import { env } from '../config/env';
import logger from '../config/logger';

import { ReferralsV2Service } from '../modules/billing/services/referrals.v2.service';
import { SubscriptionService } from '../modules/billing/services/subscription.service';

const worker = new Worker(
  'monetization',
  async (job) => {
    logger.info(`Processing monetization job ${job.name}`, { jobId: job.id, data: job.data });
    
    switch (job.name) {
      case 'referral.check-and-activate':
        await ReferralsV2Service.activateReferralAfterPayment(job.data.paymentId);
        break;
      case 'referral.credit-commission':
        await ReferralsV2Service.creditReferralCommission(job.data.referralId);
        break;
      case 'payment.welcome-email':
        logger.info(`Sending welcome email to ${job.data.userId} for plan ${job.data.planName}`);
        // TODO: integrate with email service
        break;
      case 'subscription.expiry-check':
        await SubscriptionService.checkAndExpireSubscriptions();
        break;
      default:
        logger.warn(`Unknown monetization job: ${job.name}`);
    }
  },
  {
    connection: redis,
    concurrency: Number(env.WORKER_CONCURRENCY) || 5,
  }
);

worker.on('failed', (job, err) => {
  logger.error(`Monetization job ${job?.name} failed:`, { error: err.message, stack: err.stack });
});

worker.on('completed', (job) => {
  logger.info(`Monetization job ${job.name} completed successfully`, { jobId: job.id });
});

export default worker;
