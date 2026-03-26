import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { REPORT_QUEUE_NAME } from './constants/report-queue.constants';
import { ReportQueueProducer } from './report-queue.producer';
import { ReportQueueProcessor } from './report-queue.processor';
import { ReportModule } from 'src/modules/application/report/report.module';
import { VendorModule } from 'src/modules/vendors/vendor.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: REPORT_QUEUE_NAME }),
    ReportModule,
    VendorModule,
  ],
  providers: [ReportQueueProducer, ReportQueueProcessor],
  exports: [ReportQueueProducer],
})
export class ReportQueueModule {}
