import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

export function primaryId() {
  return uuid()
    .primaryKey()
    .default(sql`uuidv7()`);
}

export function createdAt() {
  return timestamp({ withTimezone: true }).notNull().defaultNow();
}

export function updatedAt() {
  return timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
}
