import { sql } from 'drizzle-orm';
import { boolean, check, pgEnum, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { Channel } from '../../../../common/enums/channel.enums';
import { createdAt, primaryId, updatedAt } from '../../../infrastructure/database/database.columns';
import { users } from '../user.schema';

export const channel = pgEnum('channel', Channel);

export const userChannels = pgTable(
  'user_channels',
  {
    id: primaryId(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: channel().notNull(),
    externalId: text().notNull(),
    reachable: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('user_channels_user_id_channel_unique').on(table.userId, table.channel),
    unique('user_channels_channel_external_id_unique').on(table.channel, table.externalId),
    check('user_channels_external_id_length', sql`char_length(${table.externalId}) > 0`),
  ],
);
