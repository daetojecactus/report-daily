import { Module } from '@nestjs/common';
import { ReportQueueModule } from './report/report-queue.module';
import { BroadcastQueueModule } from './broadcast/broadcast-queue.module';

@Module({
  imports: [ReportQueueModule, BroadcastQueueModule],
  exports: [ReportQueueModule, BroadcastQueueModule],
})
export class QueueModule {}
