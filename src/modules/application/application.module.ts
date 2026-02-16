import { Module } from '@nestjs/common';
import { ReportModule } from './report/report.module';
import { UserModule } from './user/user.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { BotSettingsModule } from './bot-settings/bot-settings.module';
import { HolidayCalendarModule } from './holiday-calendar/holiday-calendar.module';
import { BotCommandModule } from './bot-command/bot-command.module';

@Module({
  imports: [
    ReportModule,
    UserModule,
    SchedulerModule,
    BotSettingsModule,
    HolidayCalendarModule,
    BotCommandModule,
  ],
  exports: [
    ReportModule,
    UserModule,
    SchedulerModule,
    BotSettingsModule,
    HolidayCalendarModule,
    BotCommandModule,
  ],
})
export class ApplicationModule {}
