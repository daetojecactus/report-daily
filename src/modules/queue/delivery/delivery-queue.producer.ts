import { Injectable } from '@nestjs/common';
import { Channel } from 'src/common/channel/types/channel.enums';
import { DeliverySlackQueueProducer } from '../delivery-slack/delivery-slack-queue.producer';
import { DeliveryTelegramQueueProducer } from '../delivery-telegram/delivery-telegram-queue.producer';
import type { DeliveryBroadcastMessage } from './types/delivery-queue.interface';

@Injectable()
export class DeliveryQueueProducer {
  constructor(
    private readonly deliveryTelegramQueueProducer: DeliveryTelegramQueueProducer,
    private readonly deliverySlackQueueProducer: DeliverySlackQueueProducer,
  ) {}

  addDelivery(channel: Channel, deliveryId: string) {
    switch (channel) {
      case Channel.TELEGRAM:
        return this.deliveryTelegramQueueProducer.addDelivery(deliveryId);
      case Channel.SLACK:
        return this.deliverySlackQueueProducer.addDelivery(deliveryId);
    }
  }

  addBroadcast(channel: Channel, broadcastId: string, messages: DeliveryBroadcastMessage[]) {
    switch (channel) {
      case Channel.TELEGRAM:
        return this.deliveryTelegramQueueProducer.addBroadcast(broadcastId, messages);
      case Channel.SLACK:
        return this.deliverySlackQueueProducer.addBroadcast(broadcastId, messages);
    }
  }
}
