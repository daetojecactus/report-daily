import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerTask } from './scheduler/scheduler.task';
import { CalendarTask } from './calendar/calendar.task';
import { ApplicationModule } from '../application/application.module';

@Module({
  imports: [ScheduleModule.forRoot(), ApplicationModule],
  providers: [SchedulerTask, CalendarTask],
})
export class TaskModule {}
