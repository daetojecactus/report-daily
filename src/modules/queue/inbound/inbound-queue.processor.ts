import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { getErrorMessage } from 'src/common/utils/error.util';
import { BotService } from 'src/modules/application/bot/bot.service';
import {
  INBOUND_CONCURRENCY,
  INBOUND_EVENT_JOB,
  INBOUND_QUEUE,
} from './constants/inbound-queue.constants';
import { InboundQueueMessages } from './constants/inbound-queue.messages';
import type { InboundEventJobData } from './types/inbound-queue.interface';
import { QueueHost } from '../queue.host';

@Processor(INBOUND_QUEUE, { concurrency: INBOUND_CONCURRENCY })
export class InboundQueueProcessor extends QueueHost {
  constructor(private readonly botService: BotService) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case INBOUND_EVENT_JOB:
        return this.handleEvent(job);
      default:
        throw new Error(`${InboundQueueMessages.UNKNOWN_JOB}: ${job.name}`);
    }
  }

  private async handleEvent(job: Job) {
    const { event } = job.data as InboundEventJobData;
    try {
      await this.botService.handle(event);
    } catch (error) {
      this.logger.error(
        { jobId: job.id, error: getErrorMessage(error) },
        InboundQueueMessages.EVENT_FAILED,
      );
      await this.botService.replyFailure(event);
    }
  }
}
