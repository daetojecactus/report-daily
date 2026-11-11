import { TIME_ZONE_NAME_PATTERN } from '../constants/time-zone.constants';

export function toTimeZone(value: string): string | null {
  let timeZone: string;
  try {
    timeZone = new Intl.DateTimeFormat(undefined, {
      timeZone: value.trim(),
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
  return TIME_ZONE_NAME_PATTERN.test(timeZone) ? timeZone : null;
}
