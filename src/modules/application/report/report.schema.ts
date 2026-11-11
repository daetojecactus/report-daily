import {
  boolean,
  date,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { reportTemplates } from './template/template.schema';
import { createdAt, primaryId, updatedAt } from '../../infrastructure/database/database.columns';
import { users } from '../user/user.schema';
import { ReportStatus } from './types/report.enums';
import type { ReportContext } from './template/types/template.interface';

export const reportStatus = pgEnum('report_status', ReportStatus);

export const reports = pgTable(
  'reports',
  {
    id: primaryId(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reportDate: date({ mode: 'string' }).notNull(),
    status: reportStatus().notNull(),
    scheduledAt: timestamp({ withTimezone: true }),
    snapshot: jsonb().$type<ReportContext>(),
    content: text(),
    templateId: uuid().references(() => reportTemplates.id, { onDelete: 'set null' }),
    aiUsed: boolean().notNull().default(false),
    aiModel: text(),
    error: text(),
    generatedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [unique('reports_user_id_report_date_unique').on(table.userId, table.reportDate)],
);
