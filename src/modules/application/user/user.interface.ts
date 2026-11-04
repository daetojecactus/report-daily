import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { UserChannel } from './channel/channel.interface';
import type { users } from './user.schema';

export type User = typeof users.$inferSelect;

export type UserInsert = typeof users.$inferInsert;

export type UserUpdate = PgUpdateSetSource<typeof users>;

export interface UserWithChannel {
  user: User;
  channel: UserChannel;
}
