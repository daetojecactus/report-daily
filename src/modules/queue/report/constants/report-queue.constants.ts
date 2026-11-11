import type { JobsOptions } from 'bullmq';

export const REPORT_QUEUE = 'report';

export const REPORT_BUILD_JOB = 'build';

export const REPORT_JOB_ID_PREFIX = 'report-';

export const REPORT_JOB_ID_SEPARATOR = '-';

export const REPORT_CONCURRENCY = 5;

export const REPORT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: true,
  removeOnFail: true,
};
