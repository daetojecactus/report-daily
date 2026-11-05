import { sql } from 'drizzle-orm';
import { boolean, check, pgEnum, pgTable, text, time } from 'drizzle-orm/pg-core';
import { Language } from '../i18n/i18n.enums';
import { Gender, JobRole, Permission, UserStatus } from './user.enums';
import { createdAt, primaryId, updatedAt } from '../../infrastructure/database/database.columns';
import {
  USER_DEFAULT_REPORT_TIME,
  USER_DISPLAY_NAME_MAX_LENGTH,
  USER_REPORT_TIME_STEP_MINUTES,
} from './constants/user.constants';

export const jobRole = pgEnum('job_role', JobRole);

export const gender = pgEnum('gender', Gender);

export const userStatus = pgEnum('user_status', UserStatus);

export const permission = pgEnum('permission', Permission);

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
    aiEnabled: boolean().notNull().default(true),
    aiDataOptOut: boolean().notNull().default(false),
    permissions: permission().array().notNull().default([]),
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
  ],
);
