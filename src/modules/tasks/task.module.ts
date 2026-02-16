import { Module } from '@nestjs/common';
import { SchedulerTask } from './scheduler/scheduler.task';
import { CalendarTask } from './calendar/calendar.task';
import { HolidaySeedTask } from './calendar/holiday-seed.task';
import { SchedulerModule } from '../application/scheduler/scheduler.module';
import { BotSettingsModule } from '../application/bot-settings/bot-settings.module';
import { HolidayCalendarModule } from '../application/holiday-calendar/holiday-calendar.module';

@Module({
  imports: [SchedulerModule, BotSettingsModule, HolidayCalendarModule],
  providers: [SchedulerTask, CalendarTask, HolidaySeedTask],
})
export class TaskModule {}
