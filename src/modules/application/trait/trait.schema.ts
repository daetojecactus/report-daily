import { sql } from 'drizzle-orm';
import { check, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, updatedAt } from '../../infrastructure/database/database.columns';
import { jobRole } from '../user/user.schema';
import { source } from '../user/user-source/user-source.schema';
import { TRAIT_DICTIONARY, TRAIT_SOURCE_NAME_MAX_LENGTH } from './constants/trait.constants';
import { TraitDimension } from './trait.enums';
import type { TraitValue } from './trait.interface';

export const traitDimension = pgEnum('trait_dimension', TraitDimension);

export const traitMappings = pgTable(
  'trait_mappings',
  {
    id: primaryId(),
    source: source().notNull(),
    sourceName: text().notNull(),
    sourceKey: text().notNull(),
    role: jobRole(),
    dimension: traitDimension().notNull(),
    value: text().$type<TraitValue>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('trait_mappings_source_source_key_dimension_role_unique')
      .on(table.source, table.sourceKey, table.dimension, table.role)
      .nullsNotDistinct(),
    check(
      'trait_mappings_source_name_length',
      sql`char_length(${table.sourceName}) between 1 and ${sql.raw(String(TRAIT_SOURCE_NAME_MAX_LENGTH))}`,
    ),
    check(
      'trait_mappings_dimension_value',
      sql.join(
        Object.entries(TRAIT_DICTIONARY).map(
          ([dimension, values]) =>
            sql`(${table.dimension} = ${sql.raw(`'${dimension}'`)} and ${table.value} in (${sql.raw(values.map((value) => `'${value}'`).join(', '))}))`,
        ),
        sql` or `,
      ),
    ),
  ],
);
