import type { userSources } from '../user-source.schema';

export type UserSource = typeof userSources.$inferSelect;

export type UserSourceInsert = typeof userSources.$inferInsert;
