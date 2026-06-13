export enum BroadcastQueueMessages {
  BATCH_ADDED = 'Batch of broadcast jobs added to queue',
  JOB_STARTED = 'Processing broadcast job',
  JOB_COMPLETED = 'Broadcast job completed',
  JOB_FAILED = 'Broadcast job failed',
}
