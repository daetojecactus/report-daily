import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { ReportModule } from '../report/report.module';
import { TelegramModule } from '../../vendors/telegram/telegram.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [UserModule, ReportModule, TelegramModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
