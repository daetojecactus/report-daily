import { describe, expect, it } from 'vitest';
import { toTimeZone } from '../time-zone.util';

describe('toTimeZone', () => {
  it.each([
    ['Asia/Almaty', 'Asia/Almaty'],
    [' europe/moscow ', 'Europe/Moscow'],
    ['UTC', 'UTC'],
  ])('accepts %j as %s', (value, timeZone) => {
    expect(toTimeZone(value)).toBe(timeZone);
  });

  it('accepts an alias and returns a canonical name', () => {
    expect(toTimeZone('america/argentina/buenos_aires')).toMatch(
      /^America\/(Argentina\/)?Buenos_Aires$/,
    );
  });

  it.each(['Mars/Base', '+05:00', '', 'Moscow time'])('rejects %j', (value) => {
    expect(toTimeZone(value)).toBeNull();
  });
});
