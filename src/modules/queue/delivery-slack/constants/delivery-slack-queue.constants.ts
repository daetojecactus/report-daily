import type { JobsOptions } from 'bullmq';

export const DELIVERY_SLACK_QUEUE = 'delivery-slack';

export const DELIVERY_SLACK_SEND_JOB = 'send';

export const DELIVERY_SLACK_BROADCAST_JOB = 'broadcast';

export const DELIVERY_SLACK_JOB_ID_PREFIX = 'delivery-';

export const DELIVERY_SLACK_BROADCAST_ID_PREFIX = 'broadcast-';

export const DELIVERY_SLACK_JOB_ID_SEPARATOR = '-';

export const DELIVERY_SLACK_LIMITER = { max: 5, duration: 1_000 };

export const DELIVERY_SLACK_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: true,
  removeOnFail: true,
};
