import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { ChatEvent } from 'src/common/channel/types/chat-channel.interface';
import {
  INBOUND_EVENT_JOB,
  INBOUND_JOB_OPTIONS,
  INBOUND_QUEUE,
  INBOUND_SLACK_JOB_ID_PREFIX,
  INBOUND_TELEGRAM_JOB_ID_PREFIX,
} from './constants/inbound-queue.constants';
import type { InboundEventJobData } from './types/inbound-queue.interface';

@Injectable()
export class InboundQueueProducer {
  constructor(@InjectQueue(INBOUND_QUEUE) private readonly inboundQueue: Queue) {}

  async addTelegramEvent(updateId: number, event: ChatEvent) {
    const data: InboundEventJobData = { event };
    await this.inboundQueue.add(INBOUND_EVENT_JOB, data, {
      ...INBOUND_JOB_OPTIONS,
      jobId: `${INBOUND_TELEGRAM_JOB_ID_PREFIX}${updateId}`,
    });
  }

  async addSlackEvent(key: string, event: ChatEvent) {
    const data: InboundEventJobData = { event };
    await this.inboundQueue.add(INBOUND_EVENT_JOB, data, {
      ...INBOUND_JOB_OPTIONS,
      jobId: `${INBOUND_SLACK_JOB_ID_PREFIX}${key}`,
    });
  }
}
