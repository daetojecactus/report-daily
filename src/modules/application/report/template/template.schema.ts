import { sql } from 'drizzle-orm';
import { check, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, updatedAt } from '../../../infrastructure/database/database.columns';
import { users } from '../../user/user.schema';
import { TEMPLATE_BODY_MAX_LENGTH, TEMPLATE_NAME_MAX_LENGTH } from './constants/template.constants';

export const reportTemplates = pgTable(
  'report_templates',
  {
    id: primaryId(),
    name: text().notNull(),
    body: text().notNull(),
    ownerId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      'report_templates_name_length',
      sql`char_length(${table.name}) between 1 and ${sql.raw(String(TEMPLATE_NAME_MAX_LENGTH))}`,
    ),
    check(
      'report_templates_body_length',
      sql`char_length(${table.body}) between 1 and ${sql.raw(String(TEMPLATE_BODY_MAX_LENGTH))}`,
    ),
  ],
);
