import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { deliveries } from './delivery.schema';

export type Delivery = typeof deliveries.$inferSelect;

export type DeliveryInsert = typeof deliveries.$inferInsert;

export type DeliveryUpdate = PgUpdateSetSource<typeof deliveries>;
