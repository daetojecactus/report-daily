import { DATE_PATTERN } from '../constants/date.constants';
import type { DayRange } from '../types/date.interface';

export function toDate(value: string): string | null {
  const text = value.trim();
  if (!DATE_PATTERN.test(text)) {
    return null;
  }
  try {
    return Temporal.PlainDate.from(text).toString();
  } catch {
    return null;
  }
}

export function addDays(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

export function getToday(timeZone: string) {
  return Temporal.Instant.fromEpochMilliseconds(Date.now())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();
}

export function getDayRange(date: string, timeZone: string): DayRange {
  const start = Temporal.PlainDate.from(date).toZonedDateTime({ timeZone });
  return {
    start: start.epochMilliseconds,
    end: start.add({ days: 1 }).epochMilliseconds,
  };
}

export function isWithinDay(time: string, day: DayRange) {
  const moment = Date.parse(time);
  return moment >= day.start && moment < day.end;
}
