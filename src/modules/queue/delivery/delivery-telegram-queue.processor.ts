import { Processor } from '@nestjs/bullmq';
import { type Job, Worker } from 'bullmq';
import { ReportDelivery } from 'src/modules/application/bot/report/report.delivery';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { TelegramRetryableError } from 'src/modules/vendors/telegram/telegram.error';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import {
  DELIVERY_SECOND_MS,
  DELIVERY_TELEGRAM_LIMITER,
  DELIVERY_TELEGRAM_QUEUE,
} from './constants/delivery-queue.constants';
import { DeliveryQueueMessages } from './constants/delivery-queue.messages';
import { DeliveryQueueProcessor } from './delivery-queue.processor';

@Processor(DELIVERY_TELEGRAM_QUEUE, { limiter: DELIVERY_TELEGRAM_LIMITER })
export class DeliveryTelegramQueueProcessor extends DeliveryQueueProcessor {
  constructor(
    reportDelivery: ReportDelivery,
    channelService: ChannelService,
    protected readonly chatChannel: TelegramService,
  ) {
    super(reportDelivery, channelService);
  }

  protected async waitIfLimited(error: unknown, job: Job) {
    if (!(error instanceof TelegramRetryableError) || !error.retryAfterSeconds) {
      return;
    }
    this.logger.warn(
      { jobId: job.id, retryAfterSeconds: error.retryAfterSeconds },
      DeliveryQueueMessages.RATE_LIMITED,
    );
    await this.worker.rateLimit(error.retryAfterSeconds * DELIVERY_SECOND_MS);
    throw Worker.RateLimitError();
  }
}
