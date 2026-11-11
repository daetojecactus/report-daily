import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { DeliveryMode } from 'src/modules/infrastructure/config/types/config.enums';
import { DeliveryQueueProducer } from 'src/modules/queue/delivery/delivery-queue.producer';
import { BotService } from '../bot.service';
import { AccessService } from '../core/access.service';
import { ReportDeliveryMessages } from './constants/report-delivery.messages';
import type { ReportDeliveryPlan } from './types/report-delivery.interface';
import { ReportView } from './report.view';

@Injectable()
export class ReportDelivery {
  private readonly isRedirectMode: boolean;

  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly deliveryQueueProducer: DeliveryQueueProducer,
    private readonly reportService: ReportService,
    private readonly userService: UserService,
    private readonly channelService: ChannelService,
    private readonly botService: BotService,
    private readonly accessService: AccessService,
    private readonly i18nService: I18nService,
    private readonly reportView: ReportView,
    configService: ConfigService<AppEnvs, true>,
  ) {
    this.isRedirectMode =
      configService.get('DELIVERY_MODE', { infer: true }) === DeliveryMode.REDIRECT;
  }

  async queue(report: Report, channel: Channel | null, isOwn: boolean) {
    const channels = channel ? [channel] : await this.findReceivingChannels(report.userId);
    for (const target of channels) {
      const delivery = await this.deliveryService.createForReport(
        report,
        target,
        this.isRedirectMode && !isOwn,
      );
      await this.deliveryQueueProducer.addDelivery(target, delivery.id);
    }
  }

  async prepare(deliveryId: string, channel: Channel): Promise<ReportDeliveryPlan | null> {
    const delivery = await this.deliveryService.findById(deliveryId);
    if (delivery?.status !== DeliveryStatus.QUEUED) {
      return null;
    }
    const report = delivery.reportId ? await this.reportService.findById(delivery.reportId) : null;
    const user = await this.userService.findById(delivery.userId);
    const chatIds = await this.findChatIds(delivery, channel);
    if (!report?.content || !user || chatIds.length === 0) {
      await this.deliveryService.markFailed(deliveryId, ReportDeliveryMessages.NOTHING_TO_SEND);
      return null;
    }
    const locale = this.i18nService.getLocale(user.language ?? DEFAULT_LANGUAGE);
    await this.deliveryService.countAttempt(deliveryId);
    return {
      deliveryId,
      reportId: report.id,
      chatIds,
      redirected: delivery.redirected,
      screen: this.reportView.toDeliveryScreen(
        report,
        locale,
        user.displayName,
        delivery.redirected,
      ),
    };
  }

  async markSent(plan: ReportDeliveryPlan, messageId: string) {
    await this.deliveryService.markSent(plan.deliveryId, messageId);
    await this.reportService.markDelivered(plan.reportId);
  }

  async markFailed(plan: ReportDeliveryPlan, reason: string) {
    await this.deliveryService.markFailed(plan.deliveryId, reason);
  }

  private async findReceivingChannels(userId: string) {
    const channels = await this.channelService.findReceiving(
      userId,
      this.botService.listChannels(),
    );
    return channels.map((item) => item.channel);
  }

  private async findChatIds(delivery: Delivery, channel: Channel) {
    if (delivery.redirected) {
      return this.accessService.findOwnerIds(channel);
    }
    const chat = (await this.channelService.findByUser(delivery.userId)).find(
      (item) => item.channel === channel,
    );
    return chat ? [chat.externalId] : [];
  }
}
