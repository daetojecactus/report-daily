import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  BROADCAST_QUEUE_NAME,
  BROADCAST_QUEUE_MAX_ATTEMPTS,
  BROADCAST_QUEUE_BACKOFF_TYPE,
  BROADCAST_QUEUE_BACKOFF_DELAY,
} from './constants/broadcast-queue.constants';
import { BroadcastQueueMessages } from './constants/broadcast-queue.messages';
import type { BroadcastJobData } from './broadcast-queue.interface';

@Injectable()
export class BroadcastQueueProducer {
  private readonly logger = new Logger(BroadcastQueueProducer.name);

  constructor(
    @InjectQueue(BROADCAST_QUEUE_NAME) private readonly broadcastQueue: Queue,
  ) {}

  //добавляет батч задач рассылки (всем активным получателям)
  async addBatchBroadcastJobs(jobs: BroadcastJobData[]): Promise<void> {
    const bulkJobs = jobs.map((data) => ({
      name: `broadcast:${data.telegramId}`,
      data,
      opts: {
        attempts: BROADCAST_QUEUE_MAX_ATTEMPTS,
        backoff: {
          type: BROADCAST_QUEUE_BACKOFF_TYPE,
          delay: BROADCAST_QUEUE_BACKOFF_DELAY,
        },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600 },
      },
    }));

    await this.broadcastQueue.addBulk(bulkJobs);

    this.logger.log(
      `${BroadcastQueueMessages.BATCH_ADDED}: ${jobs.length} job(s)`,
    );
  }
}
