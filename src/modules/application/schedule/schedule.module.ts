import { Module } from '@nestjs/common';
import { ReportModule } from 'src/modules/application/report/report.module';
import { SettingsModule } from 'src/modules/application/settings/settings.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { ReportQueueModule } from 'src/modules/queue/report/report-queue.module';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [UserModule, ReportModule, SettingsModule, ReportQueueModule],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
