import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BROADCAST_QUEUE_NAME } from './constants/broadcast-queue.constants';
import { BroadcastQueueProducer } from './broadcast-queue.producer';
import { BroadcastQueueProcessor } from './broadcast-queue.processor';
import { VendorModule } from 'src/modules/vendors/vendor.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: BROADCAST_QUEUE_NAME }),
    VendorModule,
  ],
  providers: [BroadcastQueueProducer, BroadcastQueueProcessor],
  exports: [BroadcastQueueProducer],
})
export class BroadcastQueueModule {}
