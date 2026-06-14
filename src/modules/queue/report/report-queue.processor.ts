import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  REPORT_QUEUE_NAME,
  REPORT_QUEUE_CONCURRENCY,
  REPORT_QUEUE_RATE_MAX,
  REPORT_QUEUE_RATE_DURATION,
} from './constants/report-queue.constants';
import { ReportQueueMessages } from './constants/report-queue.messages';
import { ReportService } from 'src/modules/application/report/report.service';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { getLocale } from 'src/common/i18n/i18n';
import { getErrorMessage } from 'src/common/helpers/error.helper';
import type { ReportJobData, ReportJobResult } from './report-queue.interface';

@Processor(REPORT_QUEUE_NAME, {
  concurrency: REPORT_QUEUE_CONCURRENCY,
  limiter: {
    max: REPORT_QUEUE_RATE_MAX,
    duration: REPORT_QUEUE_RATE_DURATION,
  },
})
export class ReportQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportQueueProcessor.name);

  constructor(
    private readonly reportService: ReportService,
    private readonly telegramService: TelegramService,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<ReportJobResult> {
    const { adminId, telegramId, date, language } = job.data;

    this.logger.log(
      `${ReportQueueMessages.JOB_STARTED}: ${adminId} (${date}), attempt ${job.attemptsMade + 1}`,
    );

    try {
      const report = await this.reportService.generateReport(adminId, date);

      if (!report.text || report.projects.length === 0) {
        this.logger.warn(`${ReportQueueMessages.JOB_EMPTY_REPORT}: ${adminId}`);
        const locale = getLocale(language);
        await this.telegramService.sendMessageTo(
          telegramId,
          locale.report.noActivity,
        );
        return { adminId, telegramId, success: true };
      }

      await this.telegramService.sendMessageTo(telegramId, report.text);

      this.logger.log(`${ReportQueueMessages.JOB_COMPLETED}: ${adminId}`);

      return { adminId, telegramId, success: true };
    } catch (error) {
      const errMsg = getErrorMessage(error);
      this.logger.error(
        `${ReportQueueMessages.JOB_FAILED}: ${adminId}, attempt ${job.attemptsMade + 1}: ${errMsg}`,
      );
      throw error;
    }
  }
}
