import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { DATABASE_INSTANCE } from './constants/database.constants';
import { DatabaseClient } from './database.client';
import { DatabaseService } from './database.service';

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      plugins: [
        new ClsPluginTransactional({
          adapter: new TransactionalAdapterDrizzleOrm({
            drizzleInstanceToken: DATABASE_INSTANCE,
          }),
        }),
      ],
    }),
  ],
  providers: [
    DatabaseClient,
    {
      provide: DATABASE_INSTANCE,
      inject: [DatabaseClient],
      useFactory: (databaseClient: DatabaseClient) => databaseClient.instance,
    },
    DatabaseService,
  ],
  exports: [DATABASE_INSTANCE, DatabaseService],
})
export class DatabaseModule {}
