import { Module } from '@nestjs/common';
import { ReportModule } from './report/report.module';
import { UserModule } from './user/user.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { BotSettingsModule } from './bot-settings/bot-settings.module';
import { HolidayCalendarModule } from './holiday-calendar/holiday-calendar.module';

@Module({
  imports: [
    ReportModule,
    UserModule,
    SchedulerModule,
    BotSettingsModule,
    HolidayCalendarModule,
  ],
  exports: [
    ReportModule,
    UserModule,
    SchedulerModule,
    BotSettingsModule,
    HolidayCalendarModule,
  ],
})
export class ApplicationModule {}
