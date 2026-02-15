import { Module } from '@nestjs/common';
import { ReportModule } from './report/report.module';
import { UserModule } from './user/user.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [ReportModule, UserModule, SchedulerModule],
  exports: [ReportModule, UserModule, SchedulerModule],
})
export class ApplicationModule {}
