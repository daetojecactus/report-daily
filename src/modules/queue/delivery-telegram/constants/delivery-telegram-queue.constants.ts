import type { JobsOptions } from 'bullmq';

export const DELIVERY_TELEGRAM_QUEUE = 'delivery-telegram';

export const DELIVERY_TELEGRAM_SEND_JOB = 'send';

export const DELIVERY_TELEGRAM_BROADCAST_JOB = 'broadcast';

export const DELIVERY_TELEGRAM_JOB_ID_PREFIX = 'delivery-';

export const DELIVERY_TELEGRAM_BROADCAST_ID_PREFIX = 'broadcast-';

export const DELIVERY_TELEGRAM_JOB_ID_SEPARATOR = '-';

export const DELIVERY_TELEGRAM_LIMITER = { max: 25, duration: 1_000 };

export const DELIVERY_TELEGRAM_SECOND_MS = 1_000;

export const DELIVERY_TELEGRAM_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: true,
  removeOnFail: true,
};
