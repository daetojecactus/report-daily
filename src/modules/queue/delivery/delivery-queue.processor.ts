import { type Job, UnrecoverableError } from 'bullmq';
import { ChatUnreachableError } from 'src/common/channel/chat-unreachable.error';
import type { ChatChannel } from 'src/common/channel/types/chat-channel.interface';
import { getErrorMessage } from 'src/common/utils/error.util';
import type { ReportDelivery } from 'src/modules/application/bot/report/report.delivery';
import type { ReportDeliveryPlan } from 'src/modules/application/bot/report/types/report-delivery.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { DELIVERY_BROADCAST_JOB, DELIVERY_SEND_JOB } from './constants/delivery-queue.constants';
import { DeliveryQueueMessages } from './constants/delivery-queue.messages';
import type { DeliveryBroadcastData, DeliveryJobData } from './types/delivery-queue.interface';
import { QueueHost } from '../queue.host';

export abstract class DeliveryQueueProcessor extends QueueHost {
  protected abstract readonly chatChannel: ChatChannel;

  constructor(
    private readonly reportDelivery: ReportDelivery,
    private readonly channelService: ChannelService,
  ) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case DELIVERY_SEND_JOB:
        return this.sendReport(job);
      case DELIVERY_BROADCAST_JOB:
        return this.sendBroadcast(job);
      default:
        throw new Error(`${DeliveryQueueMessages.UNKNOWN_JOB}: ${job.name}`);
    }
  }

  protected abstract waitIfLimited(error: unknown, job: Job): Promise<void>;

  private async sendReport(job: Job) {
    const { deliveryId } = job.data as DeliveryJobData;
    const plan = await this.reportDelivery.prepare(deliveryId, this.chatChannel.channel);
    if (!plan) {
      return;
    }
    try {
      const messageIds: string[] = [];
      for (const chatId of plan.chatIds) {
        messageIds.push(await this.chatChannel.sendScreen(chatId, plan.screen));
      }
      await this.reportDelivery.markSent(plan, messageIds[0]);
    } catch (error) {
      await this.waitIfLimited(error, job);
      if (error instanceof ChatUnreachableError) {
        if (!plan.redirected) {
          await this.channelService.updateReachable(
            this.chatChannel.channel,
            plan.chatIds[0],
            false,
          );
        }
        await this.fail(plan, error, DeliveryQueueMessages.CHAT_UNREACHABLE);
        return;
      }
      if (error instanceof UnrecoverableError) {
        await this.fail(plan, error, DeliveryQueueMessages.REJECTED);
        return;
      }
      if (this.isLastAttempt(job)) {
        await this.fail(plan, error, DeliveryQueueMessages.ATTEMPT_FAILED);
      }
      throw error;
    }
  }

  private async sendBroadcast(job: Job) {
    const { chatId, text, broadcastId } = job.data as DeliveryBroadcastData;
    try {
      await this.chatChannel.sendScreen(chatId, { text });
    } catch (error) {
      await this.waitIfLimited(error, job);
      const context = { broadcastId, channel: this.chatChannel.channel };
      if (error instanceof ChatUnreachableError) {
        await this.channelService.updateReachable(this.chatChannel.channel, chatId, false);
        this.warn(context, error, DeliveryQueueMessages.CHAT_UNREACHABLE);
        return;
      }
      if (error instanceof UnrecoverableError) {
        this.warn(context, error, DeliveryQueueMessages.REJECTED);
        return;
      }
      if (this.isLastAttempt(job)) {
        this.warn(context, error, DeliveryQueueMessages.ATTEMPT_FAILED);
      }
      throw error;
    }
  }

  private isLastAttempt(job: Job) {
    return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
  }

  private async fail(plan: ReportDeliveryPlan, error: unknown, message: DeliveryQueueMessages) {
    await this.reportDelivery.markFailed(plan, getErrorMessage(error));
    this.warn({ deliveryId: plan.deliveryId, channel: this.chatChannel.channel }, error, message);
  }

  private warn(context: object, error: unknown, message: DeliveryQueueMessages) {
    this.logger.warn({ ...context, error: getErrorMessage(error) }, message);
  }
}
