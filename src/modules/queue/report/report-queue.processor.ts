import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { getErrorMessage } from 'src/common/utils/error.util';
import { Channel } from 'src/common/enums/channel.enums';
import { BotService } from 'src/modules/application/bot/bot.service';
import { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { ReportStatus } from 'src/modules/application/report/report.enums';
import type { Report } from 'src/modules/application/report/report.interface';
import { ReportService } from 'src/modules/application/report/report.service';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { DeliveryMode } from 'src/modules/infrastructure/config/config.enums';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { DeliverySlackQueueProducer } from '../delivery-slack/delivery-slack-queue.producer';
import { DeliveryTelegramQueueProducer } from '../delivery-telegram/delivery-telegram-queue.producer';
import {
  REPORT_BUILD_JOB,
  REPORT_CONCURRENCY,
  REPORT_QUEUE,
} from './constants/report-queue.constants';
import { ReportQueueMessages } from './constants/report-queue.messages';
import type { ReportJobData } from './report-queue.interface';

@Processor(REPORT_QUEUE, { concurrency: REPORT_CONCURRENCY })
export class ReportQueueProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(ReportQueueProcessor.name);
  private readonly redirect: boolean;

  constructor(
    private readonly reportService: ReportService,
    private readonly deliveryService: DeliveryService,
    private readonly deliveryTelegramQueueProducer: DeliveryTelegramQueueProducer,
    private readonly deliverySlackQueueProducer: DeliverySlackQueueProducer,
    private readonly channelService: ChannelService,
    private readonly botService: BotService,
    configService: ConfigService<AppEnvs, true>,
  ) {
    super();
    this.redirect = configService.get('DELIVERY_MODE', { infer: true }) === DeliveryMode.REDIRECT;
  }

  async onModuleDestroy() {
    await this.worker.close();
  }

  async process(job: Job) {
    if (job.name !== REPORT_BUILD_JOB) {
      throw new Error(`${ReportQueueMessages.UNKNOWN_JOB}: ${job.name}`);
    }
    const { userId, date, maxAgeMs, own, channel, notice } = job.data as ReportJobData;
    try {
      const saved =
        maxAgeMs === 0 ? null : await this.reportService.findFresh(userId, date, maxAgeMs);
      const report = saved ?? (await this.reportService.build(userId, date));
      if (report.status === ReportStatus.EMPTY || !report.content) {
        if (notice) {
          await this.botService.sendTo(notice.target, { text: notice.empty });
        }
      } else {
        await this.deliver(report, channel ?? null, own);
      }
    } catch (error) {
      this.logger.warn(
        `${ReportQueueMessages.ATTEMPT_FAILED}: ${job.id}: ${getErrorMessage(error)}`,
      );
      if (notice && job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.botService.sendTo(notice.target, { text: notice.failed });
      }
      throw error;
    }
  }

  private async deliver(report: Report, channel: Channel | null, own: boolean) {
    const channels = channel ? [channel] : await this.findChannels(report.userId);
    for (const target of channels) {
      const delivery = await this.deliveryService.createForReport(
        report,
        target,
        this.redirect && !own,
      );
      await this.addDelivery(target, delivery.id);
    }
  }

  private async findChannels(userId: string) {
    return (await this.channelService.findByUser(userId))
      .filter((item) => item.reachable && this.botService.hasChannel(item.channel))
      .map((item) => item.channel);
  }

  private addDelivery(channel: Channel, deliveryId: string) {
    switch (channel) {
      case Channel.TELEGRAM:
        return this.deliveryTelegramQueueProducer.addDelivery(deliveryId);
      case Channel.SLACK:
        return this.deliverySlackQueueProducer.addDelivery(deliveryId);
    }
  }
}
