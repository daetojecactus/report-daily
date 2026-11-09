import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DELIVERY_TELEGRAM_QUEUE } from './constants/delivery-telegram-queue.constants';
import { DeliveryTelegramQueueProducer } from './delivery-telegram-queue.producer';

@Module({
  imports: [BullModule.registerQueue({ name: DELIVERY_TELEGRAM_QUEUE })],
  providers: [DeliveryTelegramQueueProducer],
  exports: [DeliveryTelegramQueueProducer],
})
export class DeliveryTelegramQueueModule {}
