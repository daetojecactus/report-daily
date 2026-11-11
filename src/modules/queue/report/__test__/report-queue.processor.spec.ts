import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import type { BotService } from 'src/modules/application/bot/bot.service';
import type { ReportDelivery } from 'src/modules/application/bot/report/report.delivery';
import { ReportStatus } from 'src/modules/application/report/types/report.enums';
import type { Report } from 'src/modules/application/report/types/report.interface';
import type { ReportService } from 'src/modules/application/report/report.service';
import { REPORT_BUILD_JOB } from '../constants/report-queue.constants';
import type { ReportJobData } from '../types/report-queue.interface';
import { ReportQueueProcessor } from '../report-queue.processor';

const DATA: ReportJobData = {
  userId: 'user-1',
  date: '2026-11-09',
  maxAgeMs: 300_000,
  own: true,
  channel: Channel.TELEGRAM,
  notice: {
    target: { channel: Channel.TELEGRAM, chatId: '2002', externalId: '1001' },
    empty: 'За сегодня отчёта нет.',
    failed: 'Не получилось собрать отчёт.',
  },
};
const NOTICE = DATA.notice!;

function job(attemptsMade = 0, name = REPORT_BUILD_JOB, data: Partial<ReportJobData> = {}) {
  return {
    id: 'report-user-1-2026-11-09',
    name,
    data: { ...DATA, ...data },
    attemptsMade,
    opts: { attempts: 3 },
  };
}

describe('ReportQueueProcessor', () => {
  const reportService = {
    build: vi.fn<ReportService['build']>(),
    findFresh: vi.fn<ReportService['findFresh']>(),
  };
  const reportDelivery = { queue: vi.fn<ReportDelivery['queue']>() };
  const botService = { sendTo: vi.fn<BotService['sendTo']>() };
  const processor = new ReportQueueProcessor(
    reportService as unknown as ReportService,
    reportDelivery as unknown as ReportDelivery,
    botService as unknown as BotService,
  );
  const run = (value: ReturnType<typeof job>) => processor.process(value as unknown as Job);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('hands the built report to the delivery with the channel it was asked in', async () => {
    const report = { status: ReportStatus.READY, content: 'project:\n• Fixed a bug' } as Report;
    reportService.build.mockResolvedValue(report);

    await run(job(0, REPORT_BUILD_JOB, { channel: Channel.SLACK }));

    expect(reportService.build).toHaveBeenCalledWith('user-1', '2026-11-09');
    expect(reportDelivery.queue).toHaveBeenCalledExactlyOnceWith(report, Channel.SLACK, true);
    expect(botService.sendTo).not.toHaveBeenCalled();
  });

  it.each([null, undefined])(
    'hands a report without a channel (%s) to the delivery for every channel',
    async (channel) => {
      const report = { status: ReportStatus.READY, content: 'project:\n• Fixed a bug' } as Report;
      reportService.build.mockResolvedValue(report);

      await run(job(0, REPORT_BUILD_JOB, { own: false, channel, notice: null }));

      expect(reportDelivery.queue).toHaveBeenCalledExactlyOnceWith(report, null, false);
    },
  );

  it('delivers a fresh saved report without building the day again', async () => {
    const saved = { status: ReportStatus.DELIVERED, content: 'project:\n• Fixed a bug' } as Report;
    reportService.findFresh.mockResolvedValue(saved);

    await run(job());

    expect(reportService.findFresh).toHaveBeenCalledWith('user-1', '2026-11-09', 300_000);
    expect(reportService.build).not.toHaveBeenCalled();
    expect(reportDelivery.queue).toHaveBeenCalledWith(saved, Channel.TELEGRAM, true);
  });

  it('builds again on a rebuild without looking for a saved report', async () => {
    reportService.build.mockResolvedValue({ status: ReportStatus.EMPTY, content: '' } as Report);

    await run(job(0, REPORT_BUILD_JOB, { maxAgeMs: 0 }));

    expect(reportService.findFresh).not.toHaveBeenCalled();
    expect(botService.sendTo).toHaveBeenCalledWith(NOTICE.target, { text: NOTICE.empty });
  });

  it('retries quietly and tells about the failure only after the last attempt', async () => {
    reportService.build.mockRejectedValue(new Error('GitLab answered 502'));

    await expect(run(job(0))).rejects.toThrow('GitLab answered 502');
    expect(botService.sendTo).not.toHaveBeenCalled();

    await expect(run(job(2))).rejects.toThrow('GitLab answered 502');
    expect(botService.sendTo).toHaveBeenCalledWith(NOTICE.target, { text: NOTICE.failed });
  });

  it('tells nothing about an empty day or a failure of a scheduled report', async () => {
    reportService.build.mockResolvedValueOnce({
      status: ReportStatus.EMPTY,
      content: '',
    } as Report);
    await run(job(0, REPORT_BUILD_JOB, { notice: null }));

    reportService.build.mockRejectedValueOnce(new Error('GitLab answered 502'));
    await expect(run(job(2, REPORT_BUILD_JOB, { notice: null }))).rejects.toThrow(
      'GitLab answered 502',
    );
    expect(botService.sendTo).not.toHaveBeenCalled();
    expect(reportDelivery.queue).not.toHaveBeenCalled();
  });

  it('refuses an unknown job', async () => {
    await expect(run(job(0, 'other'))).rejects.toThrow();
  });
});
