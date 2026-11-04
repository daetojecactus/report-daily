import { describe, expect, it } from 'vitest';
import { getErrorMessage, getFailureReason } from '../error.util';

describe('error util', () => {
  it('returns the message of an error or the value as text', () => {
    expect(getErrorMessage(new Error('broken'))).toBe('broken');
    expect(getErrorMessage(42)).toBe('42');
  });

  it('prefers the code of the cause as the failure reason', () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });

    expect(getFailureReason(new TypeError('fetch failed', { cause }))).toBe(
      'ECONNREFUSED',
    );
  });

  it('falls back to the error name and never to the message', () => {
    const error = new TypeError(
      'Failed to parse URL from https://x/bot123:secret',
    );

    expect(getFailureReason(error)).toBe('TypeError');
    expect(getFailureReason('text')).toBe('string');
  });
});
