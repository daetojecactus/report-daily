import { describe, expect, it } from 'vitest';
import { addDays, formatDate, parseDate, toLocalDate } from '../date.util';

const TODAY = '2026-11-04';

describe('toLocalDate', () => {
  it('returns the date in the time zone', () => {
    const moment = new Date('2026-11-04T20:00:00Z');

    expect(toLocalDate(moment, 'UTC')).toBe('2026-11-04');
    expect(toLocalDate(moment, 'Asia/Almaty')).toBe('2026-11-05');
    expect(toLocalDate(moment, 'America/New_York')).toBe('2026-11-04');
  });
});

describe('addDays', () => {
  it.each([
    ['2026-11-04', 1, '2026-11-05'],
    ['2026-11-30', 1, '2026-12-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-11-04', 365, '2027-11-04'],
  ])('adds to %s %i days', (date, days, result) => {
    expect(addDays(date, days)).toBe(result);
  });
});

describe('parseDate', () => {
  it.each([
    ['2026-11-15', '2026-11-15'],
    ['15.11.2026', '2026-11-15'],
    [' 5.1.2027 ', '2027-01-05'],
    ['15.11', '2026-11-15'],
    ['04.11', '2026-11-04'],
    ['03.11', '2027-11-03'],
    ['1.02', '2027-02-01'],
    ['01.01.2020', '2020-01-01'],
  ])('reads %j as %s', (value, date) => {
    expect(parseDate(value, TODAY)).toBe(date);
  });

  it.each([
    '31.02.2027',
    '29.02',
    '2026-13-01',
    '2026-1-5',
    '15/11/2026',
    '15.11.26',
    '0050-01-01',
    'tomorrow',
    '',
  ])('rejects %j', (value) => {
    expect(parseDate(value, TODAY)).toBeNull();
  });
});

describe('formatDate', () => {
  it('formats a date in the language', () => {
    expect(formatDate('2026-11-15', 'ru')).toBe('15 ноября 2026 г.');
    expect(formatDate('2026-11-15', 'en')).toBe('November 15, 2026');
  });
});
