import { Module } from '@nestjs/common';
import { DeliverySlackQueueModule } from '../delivery-slack/delivery-slack-queue.module';
import { DeliveryTelegramQueueModule } from '../delivery-telegram/delivery-telegram-queue.module';
import { DeliveryQueueProducer } from './delivery-queue.producer';

@Module({
  imports: [DeliveryTelegramQueueModule, DeliverySlackQueueModule],
  providers: [DeliveryQueueProducer],
  exports: [DeliveryQueueProducer],
})
export class DeliveryQueueModule {}
