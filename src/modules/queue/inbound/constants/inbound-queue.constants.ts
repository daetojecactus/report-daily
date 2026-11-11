import type { JobsOptions } from 'bullmq';

export const INBOUND_QUEUE = 'inbound';

export const INBOUND_EVENT_JOB = 'event';

export const INBOUND_TELEGRAM_JOB_ID_PREFIX = 'tg-';

export const INBOUND_SLACK_JOB_ID_PREFIX = 'slack-';

export const INBOUND_CONCURRENCY = 10;

export const INBOUND_DONE_KEEP_SECONDS = 60 * 60;

export const INBOUND_FAILED_KEEP_SECONDS = 24 * 60 * 60;

export const INBOUND_JOB_OPTIONS: JobsOptions = {
  attempts: 1,
  removeOnComplete: { age: INBOUND_DONE_KEEP_SECONDS },
  removeOnFail: { age: INBOUND_FAILED_KEEP_SECONDS },
};
