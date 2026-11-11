import { z } from 'zod';
import { BotNamespace } from '../../core/types/bot.enums';
import { ReportAction } from '../types/report.enums';

export const REPORT_DAYS_BACK = 14;

export const REPORT_DAYS_PER_ROW = 3;

export const REPORT_FIRST_OTHER_DAY = 2;

export const REPORT_TODAY_MAX_AGE_MS = 5 * 60 * 1000;

export const REPORT_REBUILD_COOLDOWN_MS = 60 * 1000;

export const REPORT_REBUILD_LIMIT_PREFIX = 'limit:report-rebuild:';

export const REPORT_SECOND_MS = 1000;

export const REPORT_DATE_TIME_SUFFIX = 'T00:00:00Z';

export const REPORT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
};

export const REPORT_DAY_BUTTON_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
};

const NAMESPACE_SCHEMA = z.literal(BotNamespace.REPORT);

export const REPORT_BUTTON_SCHEMA = z.union([
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.union([z.literal(ReportAction.MENU), z.literal(ReportAction.DAYS)]),
    ])
    .transform(([, action]) => ({ action })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.literal(ReportAction.DAY),
      z
        .string()
        .regex(/^\d{1,2}$/)
        .transform(Number)
        .refine((offset) => offset <= REPORT_DAYS_BACK),
    ])
    .transform(([, action, offset]) => ({ action, offset })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(ReportAction.REBUILD), z.iso.date()])
    .transform(([, action, date]) => ({ action, date })),
]);
