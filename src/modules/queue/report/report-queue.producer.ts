import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  REPORT_BUILD_JOB,
  REPORT_JOB_ID_PREFIX,
  REPORT_JOB_ID_SEPARATOR,
  REPORT_JOB_OPTIONS,
  REPORT_QUEUE,
} from './constants/report-queue.constants';
import type { ReportJobData } from './types/report-queue.interface';

@Injectable()
export class ReportQueueProducer {
  constructor(@InjectQueue(REPORT_QUEUE) private readonly reportQueue: Queue) {}

  async addReport(data: ReportJobData) {
    await this.reportQueue.add(REPORT_BUILD_JOB, data, {
      ...REPORT_JOB_OPTIONS,
      jobId: `${REPORT_JOB_ID_PREFIX}${[data.userId, data.date].join(REPORT_JOB_ID_SEPARATOR)}`,
    });
  }
}
