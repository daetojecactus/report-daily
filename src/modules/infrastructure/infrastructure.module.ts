import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { BullRootModule } from './queue/bull-root.module';
import { ScheduleRootModule } from './scheduler/schedule-root.module';

@Global()
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    BullRootModule,
    ScheduleRootModule,
  ],
  exports: [
    AppConfigModule,
    DatabaseModule,
    BullRootModule,
    ScheduleRootModule,
  ],
})
export class InfrastructureModule {}
