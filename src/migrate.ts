import { Logger } from '@nestjs/common';
import { DatabaseMessages } from './modules/infrastructure/database/constants/database.messages';
import { DatabaseClient } from './modules/infrastructure/database/database.client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(DatabaseMessages.DATABASE_URL_REQUIRED);
}

await DatabaseClient.runMigrations(databaseUrl);
Logger.log(DatabaseMessages.MIGRATIONS_APPLIED);
