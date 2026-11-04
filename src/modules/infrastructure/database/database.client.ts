import path from 'node:path';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { AppEnvs } from '../config/config.env';
import {
  DATABASE_MIGRATIONS_FOLDER,
  DATABASE_MIGRATIONS_POOL_SIZE,
} from './constants/database.constants';

@Injectable()
export class DatabaseClient implements OnModuleDestroy {
  private readonly pool: pg.Pool;
  private readonly client: NodePgDatabase;

  constructor(private readonly configService: ConfigService<AppEnvs, true>) {
    this.pool = new pg.Pool({
      connectionString: this.configService.get('DATABASE_URL', { infer: true }),
    });
    this.client = drizzle({ client: this.pool, casing: 'snake_case' });
  }

  static async runMigrations(databaseUrl: string) {
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      max: DATABASE_MIGRATIONS_POOL_SIZE,
    });
    try {
      await migrate(drizzle({ client: pool }), {
        migrationsFolder: path.join(
          import.meta.dirname,
          DATABASE_MIGRATIONS_FOLDER,
        ),
      });
    } finally {
      await pool.end();
    }
  }

  get instance(): NodePgDatabase {
    return this.client;
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
