import type { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import type { BotService } from 'src/modules/application/bot/bot.service';
import type { Delivery } from 'src/modules/application/delivery/types/delivery.interface';
import type { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { ReportStatus } from 'src/modules/application/report/types/report.enums';
import type { Report } from 'src/modules/application/report/types/report.interface';
import type { ReportService } from 'src/modules/application/report/report.service';
import { DeliveryMode } from 'src/modules/infrastructure/config/types/config.enums';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import type { UserChannel } from 'src/modules/application/user/channel/types/channel.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import type { DeliveryQueueProducer } from '../../delivery/delivery-queue.producer';
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
  const deliveryService = { createForReport: vi.fn<DeliveryService['createForReport']>() };
  const producer = { addDelivery: vi.fn<DeliveryQueueProducer['addDelivery']>() };
  const channelService = { findReceiving: vi.fn<ChannelService['findReceiving']>() };
  const botService = {
    sendTo: vi.fn<BotService['sendTo']>(),
    listChannels: vi.fn<BotService['listChannels']>(),
  };
  const createProcessor = (mode: DeliveryMode) =>
    new ReportQueueProcessor(
      reportService as unknown as ReportService,
      deliveryService as unknown as DeliveryService,
      producer as unknown as DeliveryQueueProducer,
      channelService as unknown as ChannelService,
      botService as unknown as BotService,
      { get: () => mode } as unknown as ConfigService<AppEnvs, true>,
    );
  const processor = createProcessor(DeliveryMode.LIVE);
  const run = (value: ReturnType<typeof job>) => processor.process(value as unknown as Job);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('delivers a report asked in Slack to Slack', async () => {
    const report = { status: ReportStatus.READY, content: 'project:\n• Fixed a bug' } as Report;
    reportService.build.mockResolvedValue(report);
    deliveryService.createForReport.mockResolvedValue({ id: 'delivery-4' } as Delivery);

    await run(job(0, REPORT_BUILD_JOB, { channel: Channel.SLACK }));

    expect(deliveryService.createForReport).toHaveBeenCalledWith(report, Channel.SLACK, false);
    expect(producer.addDelivery).toHaveBeenCalledExactlyOnceWith(Channel.SLACK, 'delivery-4');
    expect(channelService.findReceiving).not.toHaveBeenCalled();
  });

  it.each([null, undefined])(
    'delivers a report without a channel (%s) to every reachable configured channel',
    async (channel) => {
      const report = {
        userId: 'user-1',
        status: ReportStatus.READY,
        content: 'project:\n• Fixed a bug',
      } as Report;
      reportService.build.mockResolvedValue(report);
      channelService.findReceiving.mockResolvedValue([
        { channel: Channel.TELEGRAM },
        { channel: Channel.SLACK },
      ] as UserChannel[]);
      botService.listChannels.mockReturnValue([Channel.TELEGRAM, Channel.SLACK]);
      deliveryService.createForReport
        .mockResolvedValueOnce({ id: 'delivery-5' } as Delivery)
        .mockResolvedValueOnce({ id: 'delivery-6' } as Delivery);

      await run(job(0, REPORT_BUILD_JOB, { own: false, channel, notice: null }));

      expect(channelService.findReceiving).toHaveBeenCalledWith('user-1', [
        Channel.TELEGRAM,
        Channel.SLACK,
      ]);
      expect(deliveryService.createForReport.mock.calls).toEqual([
        [report, Channel.TELEGRAM, false],
        [report, Channel.SLACK, false],
      ]);
      expect(producer.addDelivery.mock.calls).toEqual([
        [Channel.TELEGRAM, 'delivery-5'],
        [Channel.SLACK, 'delivery-6'],
      ]);
    },
  );

  it('delivers nothing when no channel of the employee gets reports', async () => {
    reportService.build.mockResolvedValue({
      userId: 'user-1',
      status: ReportStatus.READY,
      content: 'project:\n• Fixed a bug',
    } as Report);
    channelService.findReceiving.mockResolvedValue([]);
    botService.listChannels.mockReturnValue([Channel.TELEGRAM]);

    await run(job(0, REPORT_BUILD_JOB, { own: false, channel: null, notice: null }));

    expect(deliveryService.createForReport).not.toHaveBeenCalled();
  });

  it('delivers the built report to the Telegram of the employee', async () => {
    const report = { status: ReportStatus.READY, content: 'project:\n• Fixed a bug' } as Report;
    reportService.build.mockResolvedValue(report);
    deliveryService.createForReport.mockResolvedValue({ id: 'delivery-1' } as Delivery);

    await run(job());

    expect(reportService.build).toHaveBeenCalledWith('user-1', '2026-11-09');
    expect(deliveryService.createForReport).toHaveBeenCalledWith(report, Channel.TELEGRAM, false);
    expect(producer.addDelivery).toHaveBeenCalledWith(Channel.TELEGRAM, 'delivery-1');
    expect(botService.sendTo).not.toHaveBeenCalled();
  });

  it('delivers a fresh saved report without building the day again', async () => {
    const saved = { status: ReportStatus.DELIVERED, content: 'project:\n• Fixed a bug' } as Report;
    reportService.findFresh.mockResolvedValue(saved);
    deliveryService.createForReport.mockResolvedValue({ id: 'delivery-2' } as Delivery);

    await run(job());

    expect(reportService.findFresh).toHaveBeenCalledWith('user-1', '2026-11-09', 300_000);
    expect(reportService.build).not.toHaveBeenCalled();
    expect(deliveryService.createForReport).toHaveBeenCalledWith(saved, Channel.TELEGRAM, false);
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
    expect(deliveryService.createForReport).not.toHaveBeenCalled();
  });

  it('redirects only the reports the employee did not ask for in the redirect mode', async () => {
    const report = { status: ReportStatus.READY, content: 'project:\n• Fixed a bug' } as Report;
    reportService.build.mockResolvedValue(report);
    deliveryService.createForReport.mockResolvedValue({ id: 'delivery-3' } as Delivery);
    const redirecting = createProcessor(DeliveryMode.REDIRECT);

    await redirecting.process(job(0, REPORT_BUILD_JOB, { own: false }) as unknown as Job);
    await redirecting.process(job() as unknown as Job);

    expect(
      deliveryService.createForReport.mock.calls.map(([, , redirected]) => redirected),
    ).toEqual([true, false]);
  });

  it('refuses an unknown job', async () => {
    await expect(run(job(0, 'other'))).rejects.toThrow();
  });
});
