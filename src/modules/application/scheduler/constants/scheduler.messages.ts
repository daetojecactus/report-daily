export enum SchedulerMessages {
  CRON_TRIGGERED = 'Cron triggered',
  NO_USERS = 'No users scheduled',
  FOUND_USERS = 'Found users for batch',
  PROCESSING = 'Processing report',
  EMPTY_REPORT = 'Empty report, skipping',
  REPORT_SENT = 'Report sent',
  BATCH_DONE = 'Batch complete',
  ATTEMPT_FAILED = 'Attempt failed, retrying',
  ALL_FAILED = 'All attempts failed',
  USER_NOT_FOUND = 'User not found',
}
