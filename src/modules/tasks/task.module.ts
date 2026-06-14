import { Module } from '@nestjs/common';
import { SchedulerTask } from './scheduler/scheduler.task';
import { CalendarTask } from './calendar/calendar.task';
import { ApplicationModule } from '../application/application.module';

@Module({
  imports: [ApplicationModule],
  providers: [SchedulerTask, CalendarTask],
})
export class TaskModule {}
