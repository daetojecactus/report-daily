export enum ReportQueueMessages {
  JOB_ADDED = 'Report job added to queue',
  BATCH_ADDED = 'Batch of report jobs added to queue',
  JOB_STARTED = 'Processing report job',
  JOB_COMPLETED = 'Report job completed',
  JOB_FAILED = 'Report job failed',
  JOB_EMPTY_REPORT = 'Empty report, sending no-activity message',
}
