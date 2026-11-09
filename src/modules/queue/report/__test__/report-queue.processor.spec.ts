import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/enums/channel.enums';
import type { BotService } from 'src/modules/application/bot/bot.service';
import type { Delivery } from 'src/modules/application/delivery/delivery.interface';
import type { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { ReportStatus } from 'src/modules/application/report/report.enums';
import type { Report } from 'src/modules/application/report/report.interface';
import type { ReportService } from 'src/modules/application/report/report.service';
import type { DeliveryTelegramQueueProducer } from '../../delivery-telegram/delivery-telegram-queue.producer';
import { REPORT_BUILD_JOB } from '../constants/report-queue.constants';
import type { ReportJobData } from '../report-queue.interface';
import { ReportQueueProcessor } from '../report-queue.processor';

const locale = new I18nService().getLocale(Language.RU);

const DATA: ReportJobData = {
  userId: 'user-1',
  date: '2026-11-09',
  language: Language.RU,
  dayText: 'сегодня',
  maxAgeMs: 300_000,
  reply: { channel: Channel.TELEGRAM, chatId: '2002', externalId: '1001' },
};

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
  const producer = { addDelivery: vi.fn<DeliveryTelegramQueueProducer['addDelivery']>() };
  const botService = { sendTo: vi.fn<BotService['sendTo']>() };
  const processor = new ReportQueueProcessor(
    reportService as unknown as ReportService,
    deliveryService as unknown as DeliveryService,
    producer as unknown as DeliveryTelegramQueueProducer,
    botService as unknown as BotService,
    new I18nService(),
  );
  const run = (value: ReturnType<typeof job>) => processor.process(value as unknown as Job);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('delivers the built report to the Telegram of the employee', async () => {
    const report = { status: ReportStatus.READY, content: 'project:\n• Fixed a bug' } as Report;
    reportService.build.mockResolvedValue(report);
    deliveryService.createForReport.mockResolvedValue({ id: 'delivery-1' } as Delivery);

    await run(job());

    expect(reportService.build).toHaveBeenCalledWith('user-1', '2026-11-09');
    expect(deliveryService.createForReport).toHaveBeenCalledWith(report, Channel.TELEGRAM);
    expect(producer.addDelivery).toHaveBeenCalledWith('delivery-1');
    expect(botService.sendTo).not.toHaveBeenCalled();
  });

  it('delivers a fresh saved report without building the day again', async () => {
    const saved = { status: ReportStatus.DELIVERED, content: 'project:\n• Fixed a bug' } as Report;
    reportService.findFresh.mockResolvedValue(saved);
    deliveryService.createForReport.mockResolvedValue({ id: 'delivery-2' } as Delivery);

    await run(job());

    expect(reportService.findFresh).toHaveBeenCalledWith('user-1', '2026-11-09', 300_000);
    expect(reportService.build).not.toHaveBeenCalled();
    expect(deliveryService.createForReport).toHaveBeenCalledWith(saved, Channel.TELEGRAM);
  });

  it('builds again on a rebuild without looking for a saved report', async () => {
    reportService.build.mockResolvedValue({ status: ReportStatus.EMPTY, content: '' } as Report);

    await run(job(0, REPORT_BUILD_JOB, { maxAgeMs: 0, dayText: '3 ноября' }));

    expect(reportService.findFresh).not.toHaveBeenCalled();
    expect(botService.sendTo).toHaveBeenCalledWith(DATA.reply, {
      text: locale.report.empty('3 ноября'),
    });
  });

  it('retries quietly and tells about the failure only after the last attempt', async () => {
    reportService.build.mockRejectedValue(new Error('GitLab answered 502'));

    await expect(run(job(0))).rejects.toThrow('GitLab answered 502');
    expect(botService.sendTo).not.toHaveBeenCalled();

    await expect(run(job(2))).rejects.toThrow('GitLab answered 502');
    expect(botService.sendTo).toHaveBeenCalledWith(DATA.reply, { text: locale.report.failed });
  });

  it('refuses an unknown job', async () => {
    await expect(run(job(0, 'other'))).rejects.toThrow();
  });
});
