import { date, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, updatedAt } from '../../infrastructure/database/database.columns';
import { users } from '../user/user.schema';
import { ReportStatus } from './report.enums';
import type { ReportContext } from './template/template.interface';

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
    snapshot: jsonb().$type<ReportContext>(),
    content: text(),
    error: text(),
    generatedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [unique('reports_user_id_report_date_unique').on(table.userId, table.reportDate)],
);
