export const REPORT_QUEUE_NAME = 'report';

//максимум параллельных обработок (баланс между скоростью и нагрузкой на API)
export const REPORT_QUEUE_CONCURRENCY = 5;

//rate limiter: не больше 20 сообщений в секунду (Telegram limit: ~30 msg/sec)
export const REPORT_QUEUE_RATE_MAX = 20;
export const REPORT_QUEUE_RATE_DURATION = 1000;

//retry: 3 попытки с экспоненциальной задержкой
export const REPORT_QUEUE_MAX_ATTEMPTS = 3;
export const REPORT_QUEUE_BACKOFF_TYPE = 'exponential' as const;
export const REPORT_QUEUE_BACKOFF_DELAY = 3000;

//TTL: если задача не начала обработку за 5 минут — удалить
export const REPORT_JOB_TIMEOUT_MS = 5 * 60 * 1000;
