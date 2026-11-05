import { describe, expect, it } from 'vitest';
import { addDays, getDayRange, isWithinDay, toDate } from '../date.util';

describe('toDate', () => {
  it.each([
    ['2026-11-03', '2026-11-03'],
    [' 2024-02-29 ', '2024-02-29'],
  ])('accepts %j as %s', (value, date) => {
    expect(toDate(value)).toBe(date);
  });

  it.each(['2026-02-30', '2026-13-01', '03.11.2026', '2026-11-03T10:00', ''])(
    'rejects %j',
    (value) => {
      expect(toDate(value)).toBeNull();
    },
  );
});

describe('addDays', () => {
  it.each([
    ['2026-11-03', -2, '2026-11-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2024-02-28', 1, '2024-02-29'],
  ])('moves %s by %i days to %s', (date, days, result) => {
    expect(addDays(date, days)).toBe(result);
  });
});

describe('getDayRange', () => {
  it('starts and ends the day at midnight of the time zone', () => {
    expect(getDayRange('2026-11-03', 'Asia/Almaty')).toEqual({
      start: Date.parse('2026-11-02T19:00:00Z'),
      end: Date.parse('2026-11-03T19:00:00Z'),
    });
  });

  it('keeps a day of 23 hours when the clocks go forward', () => {
    const day = getDayRange('2026-03-29', 'Europe/Berlin');

    expect(day.start).toBe(Date.parse('2026-03-28T23:00:00Z'));
    expect(day.end - day.start).toBe(23 * 60 * 60 * 1000);
  });
});

describe('isWithinDay', () => {
  const day = getDayRange('2026-11-03', 'UTC');

  it.each([
    ['2026-11-03T00:00:00.000Z', true],
    ['2026-11-03T23:59:59.999Z', true],
    ['2026-11-03T05:00:00.000+05:00', true],
    ['2026-11-02T23:59:59.999Z', false],
    ['2026-11-04T00:00:00.000Z', false],
  ])('tells whether %s is within the day: %s', (time, isWithin) => {
    expect(isWithinDay(time, day)).toBe(isWithin);
  });
});
