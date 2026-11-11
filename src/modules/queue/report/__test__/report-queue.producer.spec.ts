import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { REPORT_BUILD_JOB } from '../constants/report-queue.constants';
import { ReportQueueProducer } from '../report-queue.producer';

describe('ReportQueueProducer', () => {
  it('adds one build of a day of an employee with retries', async () => {
    const queue = { add: vi.fn<Queue['add']>() };
    const data = {
      userId: '019a4d2e-7c1b-7f3a-9c2d-000000000001',
      date: '2026-11-09',
      maxAgeMs: 300_000,
      own: true,
      channel: Channel.TELEGRAM,
      notice: {
        target: { channel: Channel.TELEGRAM, chatId: '1', externalId: '1' },
        empty: 'empty',
        failed: 'failed',
      },
    };

    await new ReportQueueProducer(queue as unknown as Queue).addReport(data);

    expect(queue.add).toHaveBeenCalledWith(REPORT_BUILD_JOB, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: true,
      jobId: 'report-019a4d2e-7c1b-7f3a-9c2d-000000000001-2026-11-09',
    });
    expect(queue.add.mock.calls[0][2]?.jobId).not.toContain(':');
  });
});
