import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import {
  DELIVERY_SLACK_QUEUE,
  DELIVERY_TELEGRAM_QUEUE,
} from './constants/delivery-queue.constants';
import { DeliveryQueueProducer } from './delivery-queue.producer';

@Module({
  imports: [
    BullModule.registerQueue({ name: DELIVERY_TELEGRAM_QUEUE }, { name: DELIVERY_SLACK_QUEUE }),
  ],
  providers: [DeliveryQueueProducer],
  exports: [DeliveryQueueProducer],
})
export class DeliveryQueueModule {}
