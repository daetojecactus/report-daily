import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/enums/channel.enums';
import type { BotService } from 'src/modules/application/bot/bot.service';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { ReportStatus } from 'src/modules/application/report/report.enums';
import type { Report } from 'src/modules/application/report/report.interface';
import type { ReportService } from 'src/modules/application/report/report.service';
import { REPORT_BUILD_JOB } from '../constants/report-queue.constants';
import type { ReportJobData } from '../report-queue.interface';
import { ReportQueueProcessor } from '../report-queue.processor';

const locale = new I18nService().getLocale(Language.RU);

const DATA: ReportJobData = {
  userId: 'user-1',
  date: '2026-11-09',
  language: Language.RU,
  reply: { channel: Channel.TELEGRAM, chatId: '2002', externalId: '1001' },
};

function job(attemptsMade = 0, name = REPORT_BUILD_JOB) {
  return { id: 'report-user-1-2026-11-09', name, data: DATA, attemptsMade, opts: { attempts: 3 } };
}

describe('ReportQueueProcessor', () => {
  const reportService = { build: vi.fn<ReportService['build']>() };
  const botService = { sendTo: vi.fn<BotService['sendTo']>() };
  const processor = new ReportQueueProcessor(
    reportService as unknown as ReportService,
    botService as unknown as BotService,
    new I18nService(),
  );
  const run = (value: ReturnType<typeof job>) => processor.process(value as unknown as Job);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends the built report to the chat that asked for it', async () => {
    reportService.build.mockResolvedValue({
      status: ReportStatus.READY,
      content: 'project:\n• Fixed a bug',
    } as Report);

    await run(job());

    expect(reportService.build).toHaveBeenCalledWith('user-1', '2026-11-09');
    expect(botService.sendTo).toHaveBeenCalledWith(DATA.reply, { text: 'project:\n• Fixed a bug' });
  });

  it('says that a day without actions has no report', async () => {
    reportService.build.mockResolvedValue({ status: ReportStatus.EMPTY, content: '' } as Report);

    await run(job());

    expect(botService.sendTo).toHaveBeenCalledWith(DATA.reply, { text: locale.report.empty });
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
