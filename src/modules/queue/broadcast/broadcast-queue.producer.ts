import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  BROADCAST_JOB_OPTIONS,
  BROADCAST_QUEUE_NAME,
  buildBroadcastJobName,
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
    await this.broadcastQueue.addBulk(
      jobs.map((data) => ({
        name: buildBroadcastJobName(data.telegramId),
        data,
        opts: BROADCAST_JOB_OPTIONS,
      })),
    );

    this.logger.log(
      `${BroadcastQueueMessages.BATCH_ADDED}: ${jobs.length} job(s)`,
    );
  }
}
