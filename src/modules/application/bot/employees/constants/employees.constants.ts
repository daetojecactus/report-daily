import { z } from 'zod';
import { BotNamespace } from '../../core/types/bot.enums';
import { EmployeesAction } from '../types/employees.enums';

export const EMPLOYEES_PAGE_SIZE = 8;

export const EMPLOYEES_SEARCH_LIMIT = 10;

export const EMPLOYEES_QUERY_MAX_LENGTH = 64;

export const EMPLOYEES_USERNAME_PREFIX = /^@/;

export const EMPLOYEES_ITEM_SEPARATOR = ' · ';

const PAGE_SCHEMA = z
  .string()
  .regex(/^\d{1,4}$/)
  .transform(Number);

export const EMPLOYEES_BUTTON_SCHEMA = z.union([
  z
    .tuple([z.literal(BotNamespace.EMPLOYEES), z.literal(EmployeesAction.LIST), PAGE_SCHEMA])
    .transform(([, action, page]) => ({ action, page })),
  z
    .tuple([
      z.literal(BotNamespace.EMPLOYEES),
      z.literal(EmployeesAction.CARD),
      z.uuid(),
      PAGE_SCHEMA,
    ])
    .transform(([, action, id, page]) => ({ action, id, page })),
  z
    .tuple([z.literal(BotNamespace.EMPLOYEES), z.literal(EmployeesAction.SEARCH)])
    .transform(([, action]) => ({ action })),
]);

export const EMPLOYEES_ACTIVITY_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
};

export const EMPLOYEES_REPORT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
};

export const EMPLOYEES_REPORT_DATE_SUFFIX = 'T00:00:00Z';
