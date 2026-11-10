export const APP_HOST = '0.0.0.0';

export const APP_DEFAULT_PORT = 3000;

export const ENV_LIST_SEPARATOR = ',';

export const TELEGRAM_DEFAULT_API_URL = 'https://api.telegram.org';

export const LLM_ENV_KEYS = ['LLM_BASE_URL', 'LLM_TOKEN', 'LLM_MODEL'] as const;

export const SLACK_ENV_KEYS = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'OWNER_SLACK_IDS'] as const;

export const SLACK_BOT_TOKEN_PATTERN = /^xoxb-/;

export const SLACK_APP_TOKEN_PATTERN = /^xapp-/;
