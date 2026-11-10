import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Job } from 'bullmq';
import { getErrorMessage } from 'src/common/utils/error.util';
import { Channel } from 'src/common/enums/channel.enums';
import { BotService } from 'src/modules/application/bot/bot.service';
import { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { ReportStatus } from 'src/modules/application/report/report.enums';
import { ReportService } from 'src/modules/application/report/report.service';
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

  constructor(
    private readonly reportService: ReportService,
    private readonly deliveryService: DeliveryService,
    private readonly deliveryTelegramQueueProducer: DeliveryTelegramQueueProducer,
    private readonly botService: BotService,
  ) {
    super();
  }

  async onModuleDestroy() {
    await this.worker.close();
  }

  async process(job: Job) {
    if (job.name !== REPORT_BUILD_JOB) {
      throw new Error(`${ReportQueueMessages.UNKNOWN_JOB}: ${job.name}`);
    }
    const { userId, date, maxAgeMs, notice } = job.data as ReportJobData;
    try {
      const saved =
        maxAgeMs === 0 ? null : await this.reportService.findFresh(userId, date, maxAgeMs);
      const report = saved ?? (await this.reportService.build(userId, date));
      if (report.status === ReportStatus.EMPTY || !report.content) {
        if (notice) {
          await this.botService.sendTo(notice.target, { text: notice.empty });
        }
      } else {
        const delivery = await this.deliveryService.createForReport(report, Channel.TELEGRAM);
        await this.deliveryTelegramQueueProducer.addDelivery(delivery.id);
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
}
