import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { getErrorMessage } from 'src/common/utils/error.util';
import { BotService } from 'src/modules/application/bot/bot.service';
import { ReportDelivery } from 'src/modules/application/bot/report/report.delivery';
import { ReportStatus } from 'src/modules/application/report/types/report.enums';
import { ReportService } from 'src/modules/application/report/report.service';
import {
  REPORT_BUILD_JOB,
  REPORT_CONCURRENCY,
  REPORT_QUEUE,
} from './constants/report-queue.constants';
import { ReportQueueMessages } from './constants/report-queue.messages';
import type { ReportJobData } from './types/report-queue.interface';
import { QueueHost } from '../queue.host';

@Processor(REPORT_QUEUE, { concurrency: REPORT_CONCURRENCY })
export class ReportQueueProcessor extends QueueHost {
  constructor(
    private readonly reportService: ReportService,
    private readonly reportDelivery: ReportDelivery,
    private readonly botService: BotService,
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name !== REPORT_BUILD_JOB) {
      throw new Error(`${ReportQueueMessages.UNKNOWN_JOB}: ${job.name}`);
    }
    const { userId, date, maxAgeMs, own, channel, notice } = job.data as ReportJobData;
    try {
      const channels = await this.reportDelivery.findChannels(userId, channel ?? null);
      if (channels.length === 0) {
        this.logger.warn({ userId, date }, ReportQueueMessages.NO_CHANNEL);
        return;
      }
      const saved =
        maxAgeMs === 0 ? null : await this.reportService.findFresh(userId, date, maxAgeMs);
      const report = saved ?? (await this.reportService.build(userId, date));
      if (report.status === ReportStatus.EMPTY || !report.content) {
        if (notice) {
          await this.botService.sendTo(notice.target, { text: notice.empty });
        }
      } else {
        await this.reportDelivery.queue(report, channels, own, new Date(job.timestamp));
      }
    } catch (error) {
      this.logger.warn(
        { jobId: job.id, error: getErrorMessage(error) },
        ReportQueueMessages.ATTEMPT_FAILED,
      );
      if (notice && job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.botService.sendTo(notice.target, { text: notice.failed });
      }
      throw error;
    }
  }
}
