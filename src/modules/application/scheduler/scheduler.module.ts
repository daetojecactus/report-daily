import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { ReportModule } from '../report/report.module';
import { SchedulerService } from './scheduler.service';
import { VendorModule } from 'src/modules/vendors/vendor.module';
import { QueueModule } from 'src/modules/queue/queue.module';

@Module({
  imports: [UserModule, ReportModule, VendorModule, QueueModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
