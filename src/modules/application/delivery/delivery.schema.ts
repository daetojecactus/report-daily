import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, updatedAt } from '../../infrastructure/database/database.columns';
import { reports } from '../report/report.schema';
import { channel } from '../user/channel/channel.schema';
import { users } from '../user/user.schema';
import { DeliveryKind, DeliveryStatus } from './types/delivery.enums';

export const deliveryKind = pgEnum('delivery_kind', DeliveryKind);

export const deliveryStatus = pgEnum('delivery_status', DeliveryStatus);

export const deliveries = pgTable(
  'deliveries',
  {
    id: primaryId(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: channel().notNull(),
    kind: deliveryKind().notNull(),
    reportId: uuid().references(() => reports.id, { onDelete: 'cascade' }),
    status: deliveryStatus().notNull().default(DeliveryStatus.QUEUED),
    attempts: integer().notNull().default(0),
    externalMessageId: text(),
    error: text(),
    sentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('deliveries_user_id_index').on(table.userId),
    index('deliveries_report_id_index').on(table.reportId),
  ],
);
