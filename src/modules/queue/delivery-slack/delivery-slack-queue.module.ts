import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DELIVERY_SLACK_QUEUE } from './constants/delivery-slack-queue.constants';
import { DeliverySlackQueueProducer } from './delivery-slack-queue.producer';

@Module({
  imports: [BullModule.registerQueue({ name: DELIVERY_SLACK_QUEUE })],
  providers: [DeliverySlackQueueProducer],
  exports: [DeliverySlackQueueProducer],
})
export class DeliverySlackQueueModule {}
