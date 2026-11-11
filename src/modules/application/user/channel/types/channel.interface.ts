import type { userChannels } from '../channel.schema';

export type UserChannel = typeof userChannels.$inferSelect;

export type UserChannelInsert = typeof userChannels.$inferInsert;
