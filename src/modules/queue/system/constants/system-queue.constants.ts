import type { JobsOptions } from 'bullmq';

export const SYSTEM_QUEUE = 'system';

export const SYSTEM_SCHEDULE_TICK_JOB = 'schedule-tick';

export const SYSTEM_SCHEDULE_TICK_SCHEDULER_ID = 'schedule-tick';

export const SYSTEM_SCHEDULE_TICK_PATTERN = '*/15 * * * *';

export const SYSTEM_CLEANUP_JOB = 'cleanup';

export const SYSTEM_CLEANUP_SCHEDULER_ID = 'cleanup';

export const SYSTEM_CLEANUP_PATTERN = '0 3 * * *';

export const SYSTEM_JOB_OPTIONS: JobsOptions = {
  removeOnComplete: true,
  removeOnFail: true,
};
