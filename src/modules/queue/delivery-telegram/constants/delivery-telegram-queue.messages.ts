export enum DeliveryTelegramQueueMessages {
  UNKNOWN_JOB = 'Unknown Telegram delivery job',
  NOTHING_TO_SEND = 'Nothing to send: no report text or no Telegram chat',
  CHAT_UNREACHABLE = 'Telegram chat is unreachable',
  REJECTED = 'Telegram rejected the message',
  ATTEMPT_FAILED = 'Telegram delivery attempt failed',
  RATE_LIMITED = 'Telegram asked to wait',
}
