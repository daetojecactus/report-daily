import type { JobState, JobsOptions } from 'bullmq';

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

export const REPORT_QUEUED_STATES: (JobState | 'unknown')[] = [
  'waiting',
  'waiting-children',
  'prioritized',
  'delayed',
  'active',
];
