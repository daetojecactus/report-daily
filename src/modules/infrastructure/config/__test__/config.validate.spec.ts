import { describe, expect, it } from 'vitest';
import { APP_DEFAULT_PORT } from '../constants/config.constants';
import { ConfigMessages } from '../constants/config.messages';
import { LogLevel } from '../config.enums';
import { validateEnv } from '../config.validate';

const ENV = {
  DATABASE_URL: 'postgres://report_daily:secret@localhost:5433/report_daily',
  REDIS_URL: 'redis://localhost:6380',
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
      ...ENV,
      LOG_LEVEL: LogLevel.INFO,
      PORT: APP_DEFAULT_PORT,
    });
  });

  it('converts numbers', () => {
    expect(validateEnv({ ...ENV, PORT: '8080' }).PORT).toBe(8080);
  });

  it('names every missing variable', () => {
    const message = getValidationMessage({});

    expect(message).toContain(ConfigMessages.ENV_VALIDATION_FAILED);
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('REDIS_URL');
  });

  it('rejects invalid values without printing them', () => {
    const message = getValidationMessage({
      ...ENV,
      LOG_LEVEL: 'secret-level',
      PORT: '-1',
    });

    expect(message).toContain('LOG_LEVEL');
    expect(message).toContain('PORT');
    expect(message).not.toContain('secret-level');
  });
});
