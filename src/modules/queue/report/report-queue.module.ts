import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { REPORT_QUEUE } from './constants/report-queue.constants';
import { ReportQueueProducer } from './report-queue.producer';

@Module({
  imports: [BullModule.registerQueue({ name: REPORT_QUEUE })],
  providers: [ReportQueueProducer],
  exports: [ReportQueueProducer],
})
export class ReportQueueModule {}
