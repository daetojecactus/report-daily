import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class DatabaseService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterDrizzleOrm<NodePgDatabase>>,
  ) {}

  get db() {
    return this.txHost.tx;
  }

  async ping() {
    await this.db.execute(sql`select 1`);
  }
}
