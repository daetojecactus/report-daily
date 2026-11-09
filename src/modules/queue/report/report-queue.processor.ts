import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Job } from 'bullmq';
import { getErrorMessage } from 'src/common/utils/error.util';
import { BotService } from 'src/modules/application/bot/bot.service';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { ReportStatus } from 'src/modules/application/report/report.enums';
import { ReportService } from 'src/modules/application/report/report.service';
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
    private readonly botService: BotService,
    private readonly i18nService: I18nService,
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
    const { userId, date, language, reply } = job.data as ReportJobData;
    const locale = this.i18nService.getLocale(language);
    try {
      const report = await this.reportService.build(userId, date);
      await this.botService.sendTo(reply, {
        text:
          report.status === ReportStatus.READY && report.content
            ? report.content
            : locale.report.empty,
      });
    } catch (error) {
      this.logger.warn(
        `${ReportQueueMessages.ATTEMPT_FAILED}: ${job.id}: ${getErrorMessage(error)}`,
      );
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.botService.sendTo(reply, { text: locale.report.failed });
      }
      throw error;
    }
  }
}
