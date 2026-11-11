export enum DeliveryQueueMessages {
  UNKNOWN_JOB = 'Unknown delivery job',
  CHAT_UNREACHABLE = 'Chat is unreachable',
  REJECTED = 'Channel rejected the message',
  ATTEMPT_FAILED = 'Delivery attempt failed',
  RATE_LIMITED = 'Channel asked to wait',
}
