export const TELEGRAM_MESSAGE_LIMIT = 4096;

export const TELEGRAM_HTML_SPECIAL_CHARACTERS = /[&<>"]/g;

export const TELEGRAM_HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

export const TELEGRAM_SCREEN_WIDTH = 40;

export const TELEGRAM_WIDTH_FILLER = '⠀';

export const TELEGRAM_MARKUP_PATTERN = /\*\*|`|\\(?=\S)|\]\([^)]*\)|\[/g;
