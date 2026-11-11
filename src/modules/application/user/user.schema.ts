import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  time,
  uuid,
} from 'drizzle-orm/pg-core';
import { reportTemplates } from '../report/template/template.schema';
import { Language } from '../i18n/types/i18n.enums';
import { Gender, JobRole, UserStatus } from './types/user.enums';
import { createdAt, primaryId, updatedAt } from '../../infrastructure/database/database.columns';
import {
  USER_DEFAULT_REPORT_TIME,
  USER_DISPLAY_NAME_MAX_LENGTH,
  USER_REPORT_TIME_STEP_MINUTES,
} from './constants/user.constants';

export const jobRole = pgEnum('job_role', JobRole);

export const gender = pgEnum('gender', Gender);

export const userStatus = pgEnum('user_status', UserStatus);

export const language = pgEnum('language', Language);

export const users = pgTable(
  'users',
  {
    id: primaryId(),
    displayName: text().notNull(),
    role: jobRole().notNull(),
    gender: gender().notNull(),
    status: userStatus().notNull().default(UserStatus.PENDING),
    language: language(),
    timezone: text(),
    reportTime: time({ precision: 0 }).notNull().default(USER_DEFAULT_REPORT_TIME),
    scheduleEnabled: boolean().notNull().default(true),
    aiEnabled: boolean().notNull().default(true),
    aiDataOptOut: boolean().notNull().default(false),
    isAdmin: boolean().notNull().default(false),
    templateId: uuid().references((): AnyPgColumn => reportTemplates.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      'users_display_name_length',
      sql`char_length(${table.displayName}) between 1 and ${sql.raw(String(USER_DISPLAY_NAME_MAX_LENGTH))}`,
    ),
    check(
      'users_report_time_step',
      sql`extract(minute from ${table.reportTime})::integer % ${sql.raw(String(USER_REPORT_TIME_STEP_MINUTES))} = 0`,
    ),
    index('users_template_id_index').on(table.templateId),
  ],
);
