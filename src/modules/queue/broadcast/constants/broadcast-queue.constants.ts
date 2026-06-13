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
