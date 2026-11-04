import {
  DAY_MONTH_DATE_PATTERN,
  ISO_DATE_LENGTH,
  ISO_DATE_PATTERN,
} from '../constants/time.constants';

export function toLocalDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return [read('year'), read('month'), read('day')].join('-');
}

export function addDays(isoDate: string, days: number) {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

export function parseDate(value: string, today: string) {
  const text = value.trim();
  const iso = ISO_DATE_PATTERN.exec(text);
  if (iso) {
    return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const date = DAY_MONTH_DATE_PATTERN.exec(text);
  if (!date) {
    return null;
  }
  const [, day, month, year] = date;
  if (year) {
    return toIsoDate(Number(year), Number(month), Number(day));
  }
  const thisYear = new Date(today).getUTCFullYear();
  const thisYearDate = toIsoDate(thisYear, Number(month), Number(day));
  return thisYearDate && thisYearDate < today
    ? toIsoDate(thisYear + 1, Number(month), Number(day))
    : thisYearDate;
}

export function formatDate(isoDate: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(isoDate));
}

function toIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return isValid ? date.toISOString().slice(0, ISO_DATE_LENGTH) : null;
}
