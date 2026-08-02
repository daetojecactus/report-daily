import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  buildReportJobName,
  REPORT_JOB_OPTIONS,
  REPORT_QUEUE_NAME,
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
    await this.reportQueue.add(
      buildReportJobName(data.adminId),
      data,
      REPORT_JOB_OPTIONS,
    );

    this.logger.log(
      `${ReportQueueMessages.JOB_ADDED}: ${data.adminId} (${data.date})`,
    );
  }

  //добавляет батч задач (все пользователи за час)
  async addBatchReportJobs(jobs: ReportJobData[]): Promise<void> {
    await this.reportQueue.addBulk(
      jobs.map((data) => ({
        name: buildReportJobName(data.adminId),
        data,
        opts: REPORT_JOB_OPTIONS,
      })),
    );

    this.logger.log(
      `${ReportQueueMessages.BATCH_ADDED}: ${jobs.length} job(s)`,
    );
  }
}
