import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { INBOUND_QUEUE } from './constants/inbound-queue.constants';
import { InboundQueueProducer } from './inbound-queue.producer';

@Module({
  imports: [BullModule.registerQueue({ name: INBOUND_QUEUE })],
  providers: [InboundQueueProducer],
  exports: [InboundQueueProducer],
})
export class InboundQueueModule {}
