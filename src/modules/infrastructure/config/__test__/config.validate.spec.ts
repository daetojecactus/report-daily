import { describe, expect, it } from 'vitest';
import { APP_DEFAULT_PORT, TELEGRAM_DEFAULT_API_URL } from '../constants/config.constants';
import { ConfigMessages } from '../constants/config.messages';
import { DeliveryMode, LogLevel } from '../config.enums';
import { validateEnv } from '../config.validate';

const ENV = {
  DATABASE_URL: 'postgres://report_daily:secret@localhost:5433/report_daily',
  REDIS_URL: 'redis://localhost:6380',
  APP_TIMEZONE: 'Asia/Almaty',
  OWNER_TELEGRAM_IDS: '111',
  TELEGRAM_BOT_TOKEN: '123456:secret-token',
  GITLAB_URL: 'https://gitlab.example.com',
  GITLAB_TOKEN: 'secret-gitlab-token',
};

function getValidationMessage(config: Record<string, unknown>) {
  try {
    validateEnv(config);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '';
}

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv(ENV)).toMatchObject({
      DELIVERY_MODE: DeliveryMode.LIVE,
      LOG_LEVEL: LogLevel.INFO,
      PORT: APP_DEFAULT_PORT,
      TELEGRAM_API_URL: TELEGRAM_DEFAULT_API_URL,
    });
  });

  it('converts numbers', () => {
    expect(validateEnv({ ...ENV, PORT: '8080' }).PORT).toBe(8080);
  });

  it('splits owner ids by comma and ignores spaces and empty items', () => {
    expect(
      validateEnv({ ...ENV, OWNER_TELEGRAM_IDS: ' 111, 222 ,,333 ' }).OWNER_TELEGRAM_IDS,
    ).toEqual(['111', '222', '333']);
  });

  it('accepts a local Bot API server', () => {
    expect(
      validateEnv({ ...ENV, TELEGRAM_API_URL: 'http://127.0.0.1:8081' }).TELEGRAM_API_URL,
    ).toBe('http://127.0.0.1:8081');
  });

  it('names every missing variable', () => {
    const message = getValidationMessage({});

    expect(message).toContain(ConfigMessages.ENV_VALIDATION_FAILED);
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('REDIS_URL');
    expect(message).toContain('APP_TIMEZONE');
    expect(message).toContain('OWNER_TELEGRAM_IDS');
    expect(message).toContain('TELEGRAM_BOT_TOKEN');
    expect(message).toContain('GITLAB_URL');
    expect(message).toContain('GITLAB_TOKEN');
  });

  it('leaves AI off without the LLM variables, also when they are empty', () => {
    expect(validateEnv(ENV)).not.toHaveProperty('LLM_MODEL');
    expect(validateEnv({ ...ENV, LLM_BASE_URL: '', LLM_TOKEN: '', LLM_MODEL: '' }).LLM_MODEL).toBe(
      '',
    );
  });

  it('accepts all three LLM variables, a local server too', () => {
    expect(
      validateEnv({
        ...ENV,
        LLM_BASE_URL: 'http://127.0.0.1:11434/v1',
        LLM_TOKEN: 'ollama',
        LLM_MODEL: 'qwen3:8b',
      }),
    ).toMatchObject({ LLM_BASE_URL: 'http://127.0.0.1:11434/v1', LLM_MODEL: 'qwen3:8b' });
  });

  it('accepts the whole Slack group and splits the Slack owners', () => {
    expect(
      validateEnv({
        ...ENV,
        SLACK_BOT_TOKEN: 'xoxb-secret',
        SLACK_APP_TOKEN: 'xapp-secret',
        OWNER_SLACK_IDS: ' U0OWNER01, W0OWNER02 ',
      }).OWNER_SLACK_IDS,
    ).toEqual(['U0OWNER01', 'W0OWNER02']);
  });

  it('runs with Slack alone when the Telegram variables are missing or empty', () => {
    const slack = {
      ...ENV,
      SLACK_BOT_TOKEN: 'xoxb-secret',
      SLACK_APP_TOKEN: 'xapp-secret',
      OWNER_SLACK_IDS: 'U0OWNER01',
    };
    const withoutTelegram = {
      ...slack,
      OWNER_TELEGRAM_IDS: undefined,
      TELEGRAM_BOT_TOKEN: undefined,
    };

    expect(validateEnv(withoutTelegram).TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(
      validateEnv({ ...slack, OWNER_TELEGRAM_IDS: '', TELEGRAM_BOT_TOKEN: '' }).OWNER_TELEGRAM_IDS,
    ).toEqual([]);
    expect(getValidationMessage({ ...withoutTelegram, OWNER_TELEGRAM_IDS: '111' })).toContain(
      'TELEGRAM_BOT_TOKEN',
    );
  });

  it('asks for Telegram when no channel is set', () => {
    const message = getValidationMessage({
      ...ENV,
      OWNER_TELEGRAM_IDS: undefined,
      TELEGRAM_BOT_TOKEN: undefined,
    });

    expect(message).toContain('OWNER_TELEGRAM_IDS');
    expect(message).toContain('TELEGRAM_BOT_TOKEN');
  });

  it('asks for the whole Slack group and checks it without printing values', () => {
    const message = getValidationMessage({
      ...ENV,
      SLACK_BOT_TOKEN: 'xoxp-secret',
      OWNER_SLACK_IDS: 'secret-owner',
    });

    expect(message).toContain('SLACK_BOT_TOKEN');
    expect(message).toContain('SLACK_APP_TOKEN');
    expect(message).toContain('OWNER_SLACK_IDS');
    expect(message).not.toContain('secret');
  });

  it('asks for the whole LLM group when only a part of it is set', () => {
    const message = getValidationMessage({
      ...ENV,
      LLM_BASE_URL: 'https://secret-llm.example.com',
    });

    expect(message).toContain('LLM_TOKEN');
    expect(message).toContain('LLM_MODEL');
    expect(message).not.toContain('LLM_BASE_URL');
    expect(message).not.toContain('secret');
  });

  it.each(['Mars/Base', '+05:00'])('rejects the time zone %s', (value) => {
    expect(getValidationMessage({ ...ENV, APP_TIMEZONE: value })).toContain('APP_TIMEZONE');
  });

  it('rejects an empty owner list', () => {
    expect(getValidationMessage({ ...ENV, OWNER_TELEGRAM_IDS: ' , ' })).toContain(
      'OWNER_TELEGRAM_IDS',
    );
  });

  it('rejects invalid values without printing them', () => {
    const message = getValidationMessage({
      ...ENV,
      LOG_LEVEL: 'secret-level',
      DELIVERY_MODE: 'secret-mode',
      PORT: '-1',
      OWNER_TELEGRAM_IDS: '111,secret-owner',
      TELEGRAM_API_URL: 'ftp://secret-host',
      GITLAB_URL: 'secret-gitlab-host',
    });

    expect(message).toContain('LOG_LEVEL');
    expect(message).toContain('DELIVERY_MODE');
    expect(message).toContain('PORT');
    expect(message).toContain('OWNER_TELEGRAM_IDS');
    expect(message).toContain('TELEGRAM_API_URL');
    expect(message).toContain('GITLAB_URL');
    expect(message).not.toContain('secret');
  });
});
