import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, updatedAt } from '../../../infrastructure/database/database.columns';
import { source } from '../../user/user-source/user-source.schema';
import { TRAIT_SOURCE_NAME_MAX_LENGTH } from '../constants/trait.constants';

export const traitNames = pgTable(
  'trait_names',
  {
    id: primaryId(),
    source: source().notNull(),
    sourceName: text().notNull(),
    sourceKey: text().notNull(),
    ignored: boolean().notNull().default(false),
    seenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('trait_names_source_source_key_unique').on(table.source, table.sourceKey),
    check(
      'trait_names_source_name_length',
      sql`char_length(${table.sourceName}) between 1 and ${sql.raw(String(TRAIT_SOURCE_NAME_MAX_LENGTH))}`,
    ),
  ],
);
