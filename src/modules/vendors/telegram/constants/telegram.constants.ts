import { TelegramUpdateType } from '../types/telegram.enums';

export const TELEGRAM_REQUEST_TIMEOUT_MS = 10_000;

export const TELEGRAM_POLL_TIMEOUT_SECONDS = 25;

export const TELEGRAM_ALLOWED_UPDATES = [
  TelegramUpdateType.MESSAGE,
  TelegramUpdateType.CALLBACK_QUERY,
];

export const TELEGRAM_URL_TRAILING_SLASHES = /\/+$/;

export const TELEGRAM_PRIVATE_CHAT = 'private';

export const TELEGRAM_COMMAND_ENTITY = 'bot_command';

export const TELEGRAM_COMMAND_PREFIX = '/';

export const TELEGRAM_USER_PICKER_REQUEST_ID = 1;

export const TELEGRAM_BOT_MENTION_SEPARATOR = '@';

export const TELEGRAM_BAD_REQUEST = 400;

export const TELEGRAM_FORBIDDEN = 403;

export const TELEGRAM_CONFLICT = 409;

export const TELEGRAM_TOO_MANY_REQUESTS = 429;

export const TELEGRAM_SERVER_ERROR = 500;

export const TELEGRAM_NOT_MODIFIED_DESCRIPTION = 'message is not modified';

export const TELEGRAM_LINK_PROTOCOLS = ['http:', 'https:'];

export const TELEGRAM_MESSAGE_LIMIT = 4096;

export const TELEGRAM_HTML_SPECIAL_CHARACTERS = /[&<>"]/g;

export const TELEGRAM_HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};
