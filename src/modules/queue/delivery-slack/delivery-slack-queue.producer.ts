import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  DELIVERY_SLACK_JOB_ID_PREFIX,
  DELIVERY_SLACK_JOB_OPTIONS,
  DELIVERY_SLACK_QUEUE,
  DELIVERY_SLACK_SEND_JOB,
} from './constants/delivery-slack-queue.constants';
import type { DeliverySlackJobData } from './delivery-slack-queue.interface';

@Injectable()
export class DeliverySlackQueueProducer {
  constructor(@InjectQueue(DELIVERY_SLACK_QUEUE) private readonly deliveryQueue: Queue) {}

  async addDelivery(deliveryId: string) {
    const data: DeliverySlackJobData = { deliveryId };
    await this.deliveryQueue.add(DELIVERY_SLACK_SEND_JOB, data, {
      ...DELIVERY_SLACK_JOB_OPTIONS,
      jobId: `${DELIVERY_SLACK_JOB_ID_PREFIX}${deliveryId}`,
    });
  }
}
