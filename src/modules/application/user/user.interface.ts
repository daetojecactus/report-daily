import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { Language } from '../i18n/i18n.enums';
import type { UserChannel } from './channel/channel.interface';
import type { Gender } from './user.enums';
import type { users } from './user.schema';

export type User = typeof users.$inferSelect;

export type UserInsert = typeof users.$inferInsert;

export type UserUpdate = PgUpdateSetSource<typeof users>;

export interface UserSettingsUpdate {
  language?: Language;
  reportTime?: string;
  timezone?: string | null;
  aiEnabled?: boolean;
  aiDataOptOut?: boolean;
  gender?: Gender;
  templateId?: string | null;
}

export interface UserWithChannel {
  user: User;
  channel: UserChannel;
}
