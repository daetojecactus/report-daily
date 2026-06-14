import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  REPORT_QUEUE_NAME,
  REPORT_QUEUE_MAX_ATTEMPTS,
  REPORT_QUEUE_BACKOFF_TYPE,
  REPORT_QUEUE_BACKOFF_DELAY,
} from './constants/report-queue.constants';
import { ReportQueueMessages } from './constants/report-queue.messages';
import type { ReportJobData } from './report-queue.interface';

@Injectable()
export class ReportQueueProducer {
  private readonly logger = new Logger(ReportQueueProducer.name);

  constructor(
    @InjectQueue(REPORT_QUEUE_NAME) private readonly reportQueue: Queue,
  ) {}

  //добавляет одну задачу генерации отчёта в очередь
  async addReportJob(data: ReportJobData): Promise<void> {
    await this.reportQueue.add(`report:${data.adminId}`, data, {
      attempts: REPORT_QUEUE_MAX_ATTEMPTS,
      backoff: {
        type: REPORT_QUEUE_BACKOFF_TYPE,
        delay: REPORT_QUEUE_BACKOFF_DELAY,
      },
      removeOnComplete: true,
      removeOnFail: { age: 24 * 3600 },
      timestamp: Date.now(),
      //если задача не начала обработку за 5 минут — удалить
      delay: 0,
    });

    this.logger.log(
      `${ReportQueueMessages.JOB_ADDED}: ${data.adminId} (${data.date})`,
    );
  }

  //добавляет батч задач (все пользователи за час)
  async addBatchReportJobs(jobs: ReportJobData[]): Promise<void> {
    const bulkJobs = jobs.map((data) => ({
      name: `report:${data.adminId}`,
      data,
      opts: {
        attempts: REPORT_QUEUE_MAX_ATTEMPTS,
        backoff: {
          type: REPORT_QUEUE_BACKOFF_TYPE,
          delay: REPORT_QUEUE_BACKOFF_DELAY,
        },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600 },
      },
    }));

    await this.reportQueue.addBulk(bulkJobs);

    this.logger.log(
      `${ReportQueueMessages.BATCH_ADDED}: ${jobs.length} job(s)`,
    );
  }
}
