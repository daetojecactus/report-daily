import { inject } from 'vitest';

export const TEST_OWNER_TELEGRAM_ID = 100000001;

process.env.DATABASE_URL = inject('databaseUrl');
process.env.REDIS_URL = inject('redisUrl');
process.env.TELEGRAM_API_URL = inject('telegramApiUrl');
process.env.SLACK_API_URL = inject('slackApiUrl');
process.env.TELEGRAM_BOT_TOKEN = '100000:integration-token';
process.env.OWNER_TELEGRAM_IDS = String(TEST_OWNER_TELEGRAM_ID);
process.env.GITLAB_URL = inject('gitlabUrl');
process.env.GITLAB_TOKEN = 'integration-gitlab-token';
process.env.APP_TIMEZONE = 'Asia/Almaty';
process.env.LOG_LEVEL = 'silent';
