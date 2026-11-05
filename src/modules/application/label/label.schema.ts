import { sql } from 'drizzle-orm';
import { check, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core';
import {
  createdAt,
  primaryId,
  updatedAt,
} from '../../infrastructure/database/database.columns';
import { jobRole } from '../user/user.schema';
import {
  LABEL_DICTIONARY,
  LABEL_MAX_LENGTH,
} from './constants/label.constants';
import { LabelDimension } from './label.enums';
import type { LabelValue } from './label.interface';

export const labelDimension = pgEnum('label_dimension', LabelDimension);

export const labelMappings = pgTable(
  'label_mappings',
  {
    id: primaryId(),
    label: text().notNull(),
    labelKey: text().notNull(),
    role: jobRole(),
    dimension: labelDimension().notNull(),
    value: text().$type<LabelValue>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('label_mappings_label_key_dimension_role_unique')
      .on(table.labelKey, table.dimension, table.role)
      .nullsNotDistinct(),
    check(
      'label_mappings_label_length',
      sql`char_length(${table.label}) between 1 and ${sql.raw(String(LABEL_MAX_LENGTH))}`,
    ),
    check(
      'label_mappings_dimension_value',
      sql.join(
        Object.entries(LABEL_DICTIONARY).map(
          ([dimension, values]) =>
            sql`(${table.dimension} = ${sql.raw(`'${dimension}'`)} and ${table.value} in (${sql.raw(values.map((value) => `'${value}'`).join(', '))}))`,
        ),
        sql` or `,
      ),
    ),
  ],
);
