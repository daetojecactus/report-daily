import { sql } from 'drizzle-orm';
import { boolean, check, date, integer, pgTable } from 'drizzle-orm/pg-core';
import { updatedAt } from '../../infrastructure/database/database.columns';
import { SETTINGS_AI_DEFAULTS, SETTINGS_ROW_ID } from './constants/settings.constants';

export const settings = pgTable(
  'settings',
  {
    id: integer().primaryKey().default(SETTINGS_ROW_ID),
    reportsPaused: boolean().notNull().default(false),
    reportsPausedUntil: date({ mode: 'string' }),
    aiEnabled: boolean().notNull().default(SETTINGS_AI_DEFAULTS.aiEnabled),
    aiSendCommits: boolean().notNull().default(SETTINGS_AI_DEFAULTS.aiSendCommits),
    aiSendComments: boolean().notNull().default(SETTINGS_AI_DEFAULTS.aiSendComments),
    updatedAt: updatedAt(),
  },
  (table) => [check('settings_single_row', sql`${table.id} = ${sql.raw(String(SETTINGS_ROW_ID))}`)],
);
