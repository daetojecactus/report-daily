export enum SchedulerMessages {
  SCHEDULER_CRON_TRIGGERED = 'Cron triggered',
  SCHEDULER_NO_USERS = 'No users scheduled',
  SCHEDULER_FOUND_USERS = 'Found users for batch',
  SCHEDULER_PROCESSING = 'Processing report',
  SCHEDULER_EMPTY_REPORT = 'Empty report, skipping',
  SCHEDULER_BATCH_DONE = 'Batch complete',
  SCHEDULER_ATTEMPT_FAILED = 'Attempt failed, retrying',
  SCHEDULER_ALL_FAILED = 'All attempts failed',
  SCHEDULER_NO_ACTIVITY = 'Сегодня не было активности в git. Если это ошибка — проверь настройки gitlab.',
}
