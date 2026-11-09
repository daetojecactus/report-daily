import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { traitNames } from './trait-name.schema';

export type TraitName = typeof traitNames.$inferSelect;

export type TraitNameInsert = typeof traitNames.$inferInsert;

export type TraitNameUpdate = PgUpdateSetSource<typeof traitNames>;
