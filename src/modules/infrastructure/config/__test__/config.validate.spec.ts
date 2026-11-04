import { describe, expect, it } from 'vitest';
import {
  APP_DEFAULT_PORT,
  TELEGRAM_DEFAULT_API_URL,
} from '../constants/config.constants';
import { ConfigMessages } from '../constants/config.messages';
import { LogLevel } from '../config.enums';
import { validateEnv } from '../config.validate';

const ENV = {
  DATABASE_URL: 'postgres://report_daily:secret@localhost:5433/report_daily',
  REDIS_URL: 'redis://localhost:6380',
  OWNER_TELEGRAM_IDS: '111',
  TELEGRAM_BOT_TOKEN: '123456:secret-token',
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
      validateEnv({ ...ENV, OWNER_TELEGRAM_IDS: ' 111, 222 ,,333 ' })
        .OWNER_TELEGRAM_IDS,
    ).toEqual(['111', '222', '333']);
  });

  it('accepts a local Bot API server', () => {
    expect(
      validateEnv({ ...ENV, TELEGRAM_API_URL: 'http://127.0.0.1:8081' })
        .TELEGRAM_API_URL,
    ).toBe('http://127.0.0.1:8081');
  });

  it('names every missing variable', () => {
    const message = getValidationMessage({});

    expect(message).toContain(ConfigMessages.ENV_VALIDATION_FAILED);
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('REDIS_URL');
    expect(message).toContain('OWNER_TELEGRAM_IDS');
    expect(message).toContain('TELEGRAM_BOT_TOKEN');
  });

  it('rejects an empty owner list', () => {
    expect(
      getValidationMessage({ ...ENV, OWNER_TELEGRAM_IDS: ' , ' }),
    ).toContain('OWNER_TELEGRAM_IDS');
  });

  it('rejects invalid values without printing them', () => {
    const message = getValidationMessage({
      ...ENV,
      LOG_LEVEL: 'secret-level',
      PORT: '-1',
      OWNER_TELEGRAM_IDS: '111,secret-owner',
      TELEGRAM_API_URL: 'ftp://secret-host',
    });

    expect(message).toContain('LOG_LEVEL');
    expect(message).toContain('PORT');
    expect(message).toContain('OWNER_TELEGRAM_IDS');
    expect(message).toContain('TELEGRAM_API_URL');
    expect(message).not.toContain('secret');
  });
});
