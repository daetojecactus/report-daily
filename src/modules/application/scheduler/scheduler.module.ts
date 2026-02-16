import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { ReportModule } from '../report/report.module';
import { SchedulerService } from './scheduler.service';
import { VendorModule } from 'src/modules/vendors/vendor.module';

@Module({
  imports: [UserModule, ReportModule, VendorModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
