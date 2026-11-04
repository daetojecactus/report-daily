import type { UserChannel } from './channel/channel.interface';
import type { users } from './user.schema';

export type User = typeof users.$inferSelect;

export type UserInsert = typeof users.$inferInsert;

export interface UserWithChannel {
  user: User;
  channel: UserChannel;
}
