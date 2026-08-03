import type { JobsOptions, WorkerOptions } from 'bullmq';

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 30_000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1_000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
    count: 5_000,
  },
};

export const buildVerificationJobOptions: JobsOptions = {
  ...defaultJobOptions,
  attempts: 2,
  backoff: {
    type: 'exponential',
    delay: 10_000,
  },
};

export const defaultWorkerSettings: Pick<WorkerOptions, 'stalledInterval' | 'maxStalledCount'> = {
  stalledInterval: 30_000,
  maxStalledCount: 2,
};
