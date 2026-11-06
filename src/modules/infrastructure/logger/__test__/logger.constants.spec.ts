import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { LOGGER_REDACT_CENSOR, LOGGER_REDACT_PATHS } from '../constants/logger.constants';

function writeLog(data: Record<string, unknown>) {
  let output = '';
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });

  pino({ redact: { paths: LOGGER_REDACT_PATHS, censor: LOGGER_REDACT_CENSOR } }, stream).info(data);

  return JSON.parse(output) as Record<string, unknown>;
}

describe('LOGGER_REDACT_PATHS', () => {
  it('redacts secrets up to three levels deep', () => {
    expect(
      writeLog({
        token: 'secret',
        llm: { apiKey: 'secret', model: 'model' },
        gitlab: { request: { password: 'secret' } },
      }),
    ).toMatchObject({
      token: LOGGER_REDACT_CENSOR,
      llm: { apiKey: LOGGER_REDACT_CENSOR, model: 'model' },
      gitlab: { request: { password: LOGGER_REDACT_CENSOR } },
    });
  });

  it('redacts whole request headers', () => {
    expect(
      writeLog({
        request: {
          method: 'GET',
          headers: { 'private-token': 'secret', accept: '*/*' },
        },
      }),
    ).toMatchObject({
      request: { method: 'GET', headers: LOGGER_REDACT_CENSOR },
    });
  });
});
