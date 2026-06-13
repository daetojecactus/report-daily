import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  BROADCAST_QUEUE_NAME,
  BROADCAST_QUEUE_CONCURRENCY,
  BROADCAST_QUEUE_RATE_MAX,
  BROADCAST_QUEUE_RATE_DURATION,
} from './constants/broadcast-queue.constants';
import { BroadcastQueueMessages } from './constants/broadcast-queue.messages';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { getErrorMessage } from 'src/common/helpers/error.helper';
import type {
  BroadcastJobData,
  BroadcastJobResult,
} from './broadcast-queue.types';

@Processor(BROADCAST_QUEUE_NAME, {
  concurrency: BROADCAST_QUEUE_CONCURRENCY,
  limiter: {
    max: BROADCAST_QUEUE_RATE_MAX,
    duration: BROADCAST_QUEUE_RATE_DURATION,
  },
})
export class BroadcastQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(BroadcastQueueProcessor.name);

  constructor(private readonly telegramService: TelegramService) {
    super();
  }

  async process(job: Job<BroadcastJobData>): Promise<BroadcastJobResult> {
    const { telegramId, text } = job.data;

    this.logger.log(
      `${BroadcastQueueMessages.JOB_STARTED}: ${telegramId}, attempt ${job.attemptsMade + 1}`,
    );

    try {
      await this.telegramService.sendMessageTo(telegramId, text);

      this.logger.log(`${BroadcastQueueMessages.JOB_COMPLETED}: ${telegramId}`);

      return { telegramId, success: true };
    } catch (error) {
      const errMsg = getErrorMessage(error);
      this.logger.error(
        `${BroadcastQueueMessages.JOB_FAILED}: ${telegramId}, attempt ${job.attemptsMade + 1}: ${errMsg}`,
      );
      throw error;
    }
  }
}
