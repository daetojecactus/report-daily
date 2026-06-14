import { Module } from '@nestjs/common';
import { ApiModule } from './api/api.module';
import { ApplicationModule } from './application/application.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { QueueModule } from './queue/queue.module';
import { TaskModule } from './tasks/task.module';
import { VendorModule } from './vendors/vendor.module';

@Module({
  imports: [
    InfrastructureModule,
    ApiModule,
    ApplicationModule,
    QueueModule,
    TaskModule,
    VendorModule,
  ],
})
export class AppModule {}
