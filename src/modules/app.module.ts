import { Module } from '@nestjs/common';
import { ApiModule } from './api/api.module';
import { ApplicationModule } from './application/application.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { TaskModule } from './tasks/task.module';
import { VendorModule } from './vendors/vendor.module';

@Module({
  imports: [
    AppConfigModule,
    ApiModule,
    ApplicationModule,
    DatabaseModule,
    QueueModule,
    TaskModule,
    VendorModule,
  ],
})
export class AppModule {}
