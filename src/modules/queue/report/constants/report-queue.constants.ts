import { QUEUE_FAILED_JOB_TTL_SECONDS } from '../../constants/queue.constants';

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

//общие опции задачи отчёта: одинаковы для одиночной постановки и батча
export const REPORT_JOB_OPTIONS = {
  attempts: REPORT_QUEUE_MAX_ATTEMPTS,
  backoff: {
    type: REPORT_QUEUE_BACKOFF_TYPE,
    delay: REPORT_QUEUE_BACKOFF_DELAY,
  },
  removeOnComplete: true,
  removeOnFail: { age: QUEUE_FAILED_JOB_TTL_SECONDS },
} as const;

export function buildReportJobName(adminId: string): string {
  return `report:${adminId}`;
}
