import { sql } from 'drizzle-orm';
import { check, pgEnum, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { Source } from '../../source/types/source.enums';
import { createdAt, primaryId, updatedAt } from '../../../infrastructure/database/database.columns';
import { users } from '../user.schema';

export const source = pgEnum('source', Source);

export const userSources = pgTable(
  'user_sources',
  {
    id: primaryId(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: source().notNull(),
    externalId: text().notNull(),
    username: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('user_sources_user_id_source_unique').on(table.userId, table.source),
    unique('user_sources_source_external_id_unique').on(table.source, table.externalId),
    check('user_sources_external_id_length', sql`char_length(${table.externalId}) > 0`),
  ],
);
