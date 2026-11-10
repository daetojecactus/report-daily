import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { Channel } from 'src/common/enums/channel.enums';
import { ChatUnreachableError } from 'src/common/errors/chat-unreachable.error';
import { getErrorMessage } from 'src/common/utils/error.util';
import { ReportView } from 'src/modules/application/bot/report/report.view';
import { DeliveryStatus } from 'src/modules/application/delivery/delivery.enums';
import type { Delivery } from 'src/modules/application/delivery/delivery.interface';
import { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { DEFAULT_LANGUAGE } from 'src/modules/application/i18n/constants/i18n.constants';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { ReportService } from 'src/modules/application/report/report.service';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { SlackRejectedError } from 'src/modules/vendors/slack/slack.error';
import { SlackService } from 'src/modules/vendors/slack/slack.service';
import {
  DELIVERY_SLACK_BROADCAST_JOB,
  DELIVERY_SLACK_LIMITER,
  DELIVERY_SLACK_QUEUE,
  DELIVERY_SLACK_SEND_JOB,
} from './constants/delivery-slack-queue.constants';
import { DeliverySlackQueueMessages } from './constants/delivery-slack-queue.messages';
import type {
  DeliverySlackBroadcastData,
  DeliverySlackJobData,
} from './delivery-slack-queue.interface';

@Processor(DELIVERY_SLACK_QUEUE, { limiter: DELIVERY_SLACK_LIMITER })
export class DeliverySlackQueueProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(DeliverySlackQueueProcessor.name);
  private readonly ownerIds: string[];

  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly reportService: ReportService,
    private readonly channelService: ChannelService,
    private readonly userService: UserService,
    private readonly slackService: SlackService,
    private readonly reportView: ReportView,
    private readonly i18nService: I18nService,
    configService: ConfigService<AppEnvs, true>,
  ) {
    super();
    this.ownerIds = configService.get('OWNER_SLACK_IDS', { infer: true }) ?? [];
  }

  async onModuleDestroy() {
    await this.worker.close();
  }

  async process(job: Job) {
    switch (job.name) {
      case DELIVERY_SLACK_SEND_JOB:
        return this.sendDelivery(job);
      case DELIVERY_SLACK_BROADCAST_JOB:
        return this.sendBroadcast(job);
      default:
        throw new Error(`${DeliverySlackQueueMessages.UNKNOWN_JOB}: ${job.name}`);
    }
  }

  private async sendBroadcast(job: Job) {
    const { chatId, text } = job.data as DeliverySlackBroadcastData;
    try {
      await this.slackService.sendScreen(chatId, { text });
    } catch (error) {
      if (error instanceof ChatUnreachableError) {
        await this.channelService.updateReachable(Channel.SLACK, chatId, false);
        this.warn({ jobId: job.id, chatId }, error, DeliverySlackQueueMessages.CHAT_UNREACHABLE);
        return;
      }
      if (error instanceof SlackRejectedError) {
        this.warn({ jobId: job.id, chatId }, error, DeliverySlackQueueMessages.REJECTED);
        return;
      }
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        this.warn({ jobId: job.id, chatId }, error, DeliverySlackQueueMessages.ATTEMPT_FAILED);
      }
      throw error;
    }
  }

  private async sendDelivery(job: Job) {
    const { deliveryId } = job.data as DeliverySlackJobData;
    const delivery = await this.deliveryService.findById(deliveryId);
    if (delivery?.status !== DeliveryStatus.QUEUED) {
      return;
    }
    const report = delivery.reportId ? await this.reportService.findById(delivery.reportId) : null;
    const user = await this.userService.findById(delivery.userId);
    const chatIds = await this.findChatIds(delivery);
    if (!report?.content || !user || chatIds.length === 0) {
      await this.deliveryService.markFailed(deliveryId, DeliverySlackQueueMessages.NOTHING_TO_SEND);
      return;
    }
    const screen = this.reportView.toDeliveryScreen(
      report,
      this.i18nService.getLocale(user.language ?? DEFAULT_LANGUAGE),
      user.displayName,
      delivery.redirected,
    );
    await this.deliveryService.countAttempt(deliveryId);
    try {
      const messageIds: string[] = [];
      for (const chatId of chatIds) {
        messageIds.push(await this.slackService.sendScreen(chatId, screen));
      }
      await this.deliveryService.markSent(deliveryId, messageIds[0]);
      await this.reportService.markDelivered(report.id);
    } catch (error) {
      if (error instanceof ChatUnreachableError) {
        if (!delivery.redirected) {
          await this.channelService.updateReachable(Channel.SLACK, chatIds[0], false);
        }
        await this.fail(deliveryId, error, DeliverySlackQueueMessages.CHAT_UNREACHABLE);
        return;
      }
      if (error instanceof SlackRejectedError) {
        await this.fail(deliveryId, error, DeliverySlackQueueMessages.REJECTED);
        return;
      }
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.fail(deliveryId, error, DeliverySlackQueueMessages.ATTEMPT_FAILED);
      }
      throw error;
    }
  }

  private async findChatIds(delivery: Delivery) {
    if (delivery.redirected) {
      return this.ownerIds;
    }
    const chat = (await this.channelService.findByUser(delivery.userId)).find(
      (item) => item.channel === Channel.SLACK,
    );
    return chat ? [chat.externalId] : [];
  }

  private async fail(deliveryId: string, error: unknown, message: DeliverySlackQueueMessages) {
    await this.deliveryService.markFailed(deliveryId, getErrorMessage(error));
    this.warn({ deliveryId }, error, message);
  }

  private warn(context: object, error: unknown, message: DeliverySlackQueueMessages) {
    this.logger.warn({ ...context, error: getErrorMessage(error) }, message);
  }
}
