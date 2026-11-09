import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { type Job, Worker } from 'bullmq';
import { Channel } from 'src/common/enums/channel.enums';
import { ChatUnreachableError } from 'src/common/errors/chat-unreachable.error';
import { getErrorMessage } from 'src/common/utils/error.util';
import { DeliveryStatus } from 'src/modules/application/delivery/delivery.enums';
import { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { ReportService } from 'src/modules/application/report/report.service';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import {
  TelegramRejectedError,
  TelegramRetryableError,
} from 'src/modules/vendors/telegram/telegram.error';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import {
  DELIVERY_TELEGRAM_LIMITER,
  DELIVERY_TELEGRAM_QUEUE,
  DELIVERY_TELEGRAM_SECOND_MS,
  DELIVERY_TELEGRAM_SEND_JOB,
} from './constants/delivery-telegram-queue.constants';
import { DeliveryTelegramQueueMessages } from './constants/delivery-telegram-queue.messages';
import type { DeliveryTelegramJobData } from './delivery-telegram-queue.interface';

@Processor(DELIVERY_TELEGRAM_QUEUE, { limiter: DELIVERY_TELEGRAM_LIMITER })
export class DeliveryTelegramQueueProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(DeliveryTelegramQueueProcessor.name);

  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly reportService: ReportService,
    private readonly channelService: ChannelService,
    private readonly telegramService: TelegramService,
  ) {
    super();
  }

  async onModuleDestroy() {
    await this.worker.close();
  }

  async process(job: Job) {
    if (job.name !== DELIVERY_TELEGRAM_SEND_JOB) {
      throw new Error(`${DeliveryTelegramQueueMessages.UNKNOWN_JOB}: ${job.name}`);
    }
    const { deliveryId } = job.data as DeliveryTelegramJobData;
    const delivery = await this.deliveryService.findById(deliveryId);
    if (delivery?.status !== DeliveryStatus.QUEUED) {
      return;
    }
    const report = delivery.reportId ? await this.reportService.findById(delivery.reportId) : null;
    const chat = (await this.channelService.findByUser(delivery.userId)).find(
      (item) => item.channel === Channel.TELEGRAM,
    );
    if (!report?.content || !chat) {
      await this.deliveryService.markFailed(
        deliveryId,
        DeliveryTelegramQueueMessages.NOTHING_TO_SEND,
      );
      return;
    }
    await this.deliveryService.countAttempt(deliveryId);
    try {
      const messageId = await this.telegramService.sendScreen(chat.externalId, {
        text: report.content,
      });
      await this.deliveryService.markSent(deliveryId, messageId);
      await this.reportService.markDelivered(report.id);
    } catch (error) {
      if (error instanceof TelegramRetryableError && error.retryAfterSeconds) {
        this.logger.warn(
          { deliveryId, retryAfterSeconds: error.retryAfterSeconds },
          DeliveryTelegramQueueMessages.RATE_LIMITED,
        );
        await this.worker.rateLimit(error.retryAfterSeconds * DELIVERY_TELEGRAM_SECOND_MS);
        throw Worker.RateLimitError();
      }
      if (error instanceof ChatUnreachableError) {
        await this.channelService.updateReachable(Channel.TELEGRAM, chat.externalId, false);
        await this.fail(deliveryId, error, DeliveryTelegramQueueMessages.CHAT_UNREACHABLE);
        return;
      }
      if (error instanceof TelegramRejectedError) {
        await this.fail(deliveryId, error, DeliveryTelegramQueueMessages.REJECTED);
        return;
      }
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.fail(deliveryId, error, DeliveryTelegramQueueMessages.ATTEMPT_FAILED);
      }
      throw error;
    }
  }

  private async fail(deliveryId: string, error: unknown, message: DeliveryTelegramQueueMessages) {
    await this.deliveryService.markFailed(deliveryId, getErrorMessage(error));
    this.logger.warn({ deliveryId, error: getErrorMessage(error) }, message);
  }
}
