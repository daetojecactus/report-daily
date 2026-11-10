import { Module } from '@nestjs/common';
import { ScheduleModule } from 'src/modules/application/schedule/schedule.module';
import { SystemModule } from 'src/modules/application/system/system.module';
import { CleanupTask } from './cleanup/cleanup.task';
import { ScheduleTask } from './schedule/schedule.task';

@Module({
  imports: [ScheduleModule, SystemModule],
  providers: [ScheduleTask, CleanupTask],
})
export class TaskModule {}
