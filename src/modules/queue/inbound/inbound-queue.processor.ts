import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
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

@Processor(INBOUND_QUEUE, { concurrency: INBOUND_CONCURRENCY })
export class InboundQueueProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(InboundQueueProcessor.name);

  constructor(private readonly botService: BotService) {
    super();
  }

  async onModuleDestroy() {
    await this.worker.close();
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
