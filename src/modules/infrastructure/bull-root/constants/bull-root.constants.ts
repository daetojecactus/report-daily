const SECONDS_IN_DAY = 24 * 60 * 60;

export const QUEUE_KEY_PREFIX = 'rd';

export const QUEUE_DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: SECONDS_IN_DAY, count: 1000 },
  removeOnFail: { age: 14 * SECONDS_IN_DAY },
};
