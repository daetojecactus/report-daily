export enum DeliverySlackQueueMessages {
  UNKNOWN_JOB = 'Unknown Slack delivery job',
  NOTHING_TO_SEND = 'Nothing to send: no report text or no Slack chat',
  CHAT_UNREACHABLE = 'Slack chat is unreachable',
  REJECTED = 'Slack rejected the message',
  ATTEMPT_FAILED = 'Slack delivery attempt failed',
}
