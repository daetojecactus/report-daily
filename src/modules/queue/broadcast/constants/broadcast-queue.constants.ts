import { QUEUE_FAILED_JOB_TTL_SECONDS } from '../../constants/queue.constants';

export const BROADCAST_QUEUE_NAME = 'broadcast';

//максимум параллельных отправок (баланс между скоростью и нагрузкой на API)
export const BROADCAST_QUEUE_CONCURRENCY = 5;

//rate limiter: не больше 20 сообщений в секунду (Telegram limit: ~30 msg/sec)
export const BROADCAST_QUEUE_RATE_MAX = 20;
export const BROADCAST_QUEUE_RATE_DURATION = 1000;

//retry: 3 попытки с экспоненциальной задержкой
export const BROADCAST_QUEUE_MAX_ATTEMPTS = 3;
export const BROADCAST_QUEUE_BACKOFF_TYPE = 'exponential' as const;
export const BROADCAST_QUEUE_BACKOFF_DELAY = 3000;

//общие опции задачи рассылки
export const BROADCAST_JOB_OPTIONS = {
  attempts: BROADCAST_QUEUE_MAX_ATTEMPTS,
  backoff: {
    type: BROADCAST_QUEUE_BACKOFF_TYPE,
    delay: BROADCAST_QUEUE_BACKOFF_DELAY,
  },
  removeOnComplete: true,
  removeOnFail: { age: QUEUE_FAILED_JOB_TTL_SECONDS },
} as const;

export function buildBroadcastJobName(telegramId: number): string {
  return `broadcast:${telegramId}`;
}
