export enum TelegramPollerMessages {
  POLLING_FAILED = 'Telegram polling failed',
  POLLING_REJECTED = 'Telegram rejected polling, check TELEGRAM_BOT_TOKEN',
  POLLING_CONFLICT = 'Telegram polling conflict, removing webhook',
  LOCK_RELEASE_FAILED = 'Telegram poller lock release failed',
}
