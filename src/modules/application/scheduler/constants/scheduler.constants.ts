export const SCHEDULER_MAX_RETRIES = 2;

//база линейной задержки между попытками: 2с, 4с, ...
export const SCHEDULER_RETRY_BASE_DELAY_MS = 2000;

//диапазон количества дней для ручной массовой рассылки отчётов за прошлые дни
export const RECENT_REPORTS_DEFAULT_DAYS = 3;
export const RECENT_REPORTS_MAX_DAYS = 14;
