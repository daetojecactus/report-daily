import { Injectable } from '@nestjs/common';
import type { Channel } from 'src/common/channel/types/channel.enums';
import { DeliveryStatus } from 'src/modules/application/delivery/types/delivery.enums';
import type { Delivery } from 'src/modules/application/delivery/types/delivery.interface';
import { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { DEFAULT_LANGUAGE } from 'src/modules/application/i18n/constants/i18n.constants';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { Report } from 'src/modules/application/report/types/report.interface';
import { ReportService } from 'src/modules/application/report/report.service';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { UserService } from 'src/modules/application/user/user.service';
import { DeliveryQueueProducer } from 'src/modules/queue/delivery/delivery-queue.producer';
import { BotService } from '../bot.service';
import { ReportDeliveryMessages } from './constants/report-delivery.messages';
import type { ReportDeliveryPlan } from './types/report-delivery.interface';
import { ReportView } from './report.view';

@Injectable()
export class ReportDelivery {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly deliveryQueueProducer: DeliveryQueueProducer,
    private readonly reportService: ReportService,
    private readonly userService: UserService,
    private readonly channelService: ChannelService,
    private readonly botService: BotService,
    private readonly i18nService: I18nService,
    private readonly reportView: ReportView,
  ) {}

  async findChannels(userId: string, channel: Channel | null) {
    if (channel) {
      return [channel];
    }
    const channels = await this.channelService.findReceiving(
      userId,
      this.botService.listChannels(),
    );
    return channels.map((item) => item.channel);
  }

  async queue(report: Report, channels: Channel[], jobCreatedAt: Date) {
    for (const channel of channels) {
      const delivery =
        (await this.deliveryService.findForReport(report.id, channel, jobCreatedAt)) ??
        (await this.deliveryService.createForReport(report, channel));
      await this.deliveryQueueProducer.addDelivery(channel, delivery.id);
    }
  }

  async prepare(deliveryId: string, channel: Channel): Promise<ReportDeliveryPlan | null> {
    const delivery = await this.deliveryService.findById(deliveryId);
    if (delivery?.status !== DeliveryStatus.QUEUED) {
      return null;
    }
    const report = delivery.reportId ? await this.reportService.findById(delivery.reportId) : null;
    const user = await this.userService.findById(delivery.userId);
    const chatId = await this.findChatId(delivery, channel);
    if (!report?.content || !user || !chatId) {
      await this.deliveryService.markFailed(deliveryId, ReportDeliveryMessages.NOTHING_TO_SEND);
      return null;
    }
    const locale = this.i18nService.getLocale(user.language ?? DEFAULT_LANGUAGE);
    await this.deliveryService.countAttempt(deliveryId);
    return {
      deliveryId,
      reportId: report.id,
      chatId,
      screen: this.reportView.toReportScreen(report, locale),
    };
  }

  async markSent(plan: ReportDeliveryPlan, messageId: string) {
    await this.deliveryService.markSent(plan.deliveryId, messageId);
    await this.reportService.markDelivered(plan.reportId);
  }

  async markFailed(plan: ReportDeliveryPlan, reason: string) {
    await this.deliveryService.markFailed(plan.deliveryId, reason);
  }

  private async findChatId(delivery: Delivery, channel: Channel) {
    const chat = (await this.channelService.findByUser(delivery.userId)).find(
      (item) => item.channel === channel,
    );
    return chat?.externalId ?? null;
  }
}
