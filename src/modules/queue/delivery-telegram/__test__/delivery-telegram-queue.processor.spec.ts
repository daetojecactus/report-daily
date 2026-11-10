import type { ConfigService } from '@nestjs/config';
import { type Job, RateLimitError } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/enums/channel.enums';
import { ReportView } from 'src/modules/application/bot/report/report.view';
import { ChatUnreachableError } from 'src/common/errors/chat-unreachable.error';
import { DeliveryStatus } from 'src/modules/application/delivery/delivery.enums';
import type { Delivery } from 'src/modules/application/delivery/delivery.interface';
import type { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { Report } from 'src/modules/application/report/report.interface';
import type { ReportService } from 'src/modules/application/report/report.service';
import type { UserChannel } from 'src/modules/application/user/channel/channel.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import type { User } from 'src/modules/application/user/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import {
  TelegramRejectedError,
  TelegramRetryableError,
} from 'src/modules/vendors/telegram/telegram.error';
import type { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { DELIVERY_TELEGRAM_SEND_JOB } from '../constants/delivery-telegram-queue.constants';
import { DeliveryTelegramQueueMessages } from '../constants/delivery-telegram-queue.messages';
import { DeliveryTelegramQueueProcessor } from '../delivery-telegram-queue.processor';

const DELIVERY = {
  id: 'delivery-1',
  userId: 'user-1',
  reportId: 'report-1',
  status: DeliveryStatus.QUEUED,
  redirected: false,
} as Delivery;

const REPORT = {
  id: 'report-1',
  reportDate: '2026-11-09',
  content: 'project:\n• Fixed a bug',
} as Report;

const CHAT = { channel: Channel.TELEGRAM, externalId: '1001' } as UserChannel;

function job(attemptsMade = 0) {
  return {
    name: DELIVERY_TELEGRAM_SEND_JOB,
    data: { deliveryId: 'delivery-1' },
    attemptsMade,
    opts: { attempts: 5 },
  } as unknown as Job;
}

describe('DeliveryTelegramQueueProcessor', () => {
  const deliveryService = {
    findById: vi.fn<DeliveryService['findById']>(),
    countAttempt: vi.fn<DeliveryService['countAttempt']>(),
    markSent: vi.fn<DeliveryService['markSent']>(),
    markFailed: vi.fn<DeliveryService['markFailed']>(),
  };
  const reportService = {
    findById: vi.fn<ReportService['findById']>(),
    markDelivered: vi.fn<ReportService['markDelivered']>(),
  };
  const channelService = {
    findByUser: vi.fn<ChannelService['findByUser']>(),
    updateReachable: vi.fn<ChannelService['updateReachable']>(),
  };
  const telegramService = { sendScreen: vi.fn<TelegramService['sendScreen']>() };
  const userService = { findById: vi.fn<UserService['findById']>() };
  const worker = { rateLimit: vi.fn() };
  const processor = new DeliveryTelegramQueueProcessor(
    deliveryService as unknown as DeliveryService,
    reportService as unknown as ReportService,
    channelService as unknown as ChannelService,
    userService as unknown as UserService,
    telegramService as unknown as TelegramService,
    new ReportView(),
    new I18nService(),
    { get: () => ['100', '101'] } as unknown as ConfigService<AppEnvs, true>,
  );
  Object.defineProperty(processor, 'worker', { get: () => worker });

  beforeEach(() => {
    vi.resetAllMocks();
    deliveryService.findById.mockResolvedValue(DELIVERY);
    reportService.findById.mockResolvedValue(REPORT);
    channelService.findByUser.mockResolvedValue([CHAT]);
    userService.findById.mockResolvedValue({
      language: Language.RU,
      displayName: 'Анна_С',
    } as User);
  });

  it('sends the report to the Telegram chat and marks the delivery and the report', async () => {
    telegramService.sendScreen.mockResolvedValue('300000007');

    await processor.process(job());

    expect(deliveryService.countAttempt).toHaveBeenCalledWith('delivery-1');
    expect(telegramService.sendScreen).toHaveBeenCalledWith('1001', {
      text: REPORT.content,
      buttons: [[{ text: 'Пересобрать', data: 'rpt:rebuild:2026-11-09' }]],
    });
    expect(deliveryService.markSent).toHaveBeenCalledWith('delivery-1', '300000007');
    expect(reportService.markDelivered).toHaveBeenCalledWith('report-1');
  });

  it('sends a redirected report to every owner with whom it was for and without buttons', async () => {
    deliveryService.findById.mockResolvedValue({ ...DELIVERY, redirected: true });
    telegramService.sendScreen.mockResolvedValueOnce('500').mockResolvedValueOnce('501');
    const text = [
      new I18nService().getLocale(Language.RU).delivery.redirected('Анна\\_С'),
      '',
      REPORT.content,
    ].join('\n');

    await processor.process(job());

    expect(telegramService.sendScreen.mock.calls).toEqual([
      ['100', { text }],
      ['101', { text }],
    ]);
    expect(channelService.findByUser).not.toHaveBeenCalled();
    expect(deliveryService.markSent).toHaveBeenCalledWith('delivery-1', '500');
    expect(reportService.markDelivered).toHaveBeenCalledWith('report-1');
  });

  it('keeps the chat of the employee reachable when an owner blocked the bot', async () => {
    deliveryService.findById.mockResolvedValue({ ...DELIVERY, redirected: true });
    telegramService.sendScreen.mockRejectedValue(new ChatUnreachableError('blocked'));

    await processor.process(job());

    expect(channelService.updateReachable).not.toHaveBeenCalled();
    expect(deliveryService.markFailed).toHaveBeenCalledWith('delivery-1', 'blocked');
  });

  it('skips a delivery that is gone or already handled', async () => {
    deliveryService.findById.mockResolvedValueOnce(null as unknown as Delivery);
    await processor.process(job());
    deliveryService.findById.mockResolvedValueOnce({ ...DELIVERY, status: DeliveryStatus.SENT });
    await processor.process(job());

    expect(telegramService.sendScreen).not.toHaveBeenCalled();
  });

  it('fails a delivery without a text or a chat', async () => {
    channelService.findByUser.mockResolvedValue([]);

    await processor.process(job());

    expect(deliveryService.markFailed).toHaveBeenCalledWith(
      'delivery-1',
      DeliveryTelegramQueueMessages.NOTHING_TO_SEND,
    );
    expect(telegramService.sendScreen).not.toHaveBeenCalled();
  });

  it('pauses the whole queue for retry_after without spending the attempt', async () => {
    telegramService.sendScreen.mockRejectedValue(new TelegramRetryableError('429', 7));

    await expect(processor.process(job())).rejects.toBeInstanceOf(RateLimitError);

    expect(worker.rateLimit).toHaveBeenCalledWith(7000);
    expect(deliveryService.markFailed).not.toHaveBeenCalled();
  });

  it('marks the chat unreachable when the bot is blocked and does not retry', async () => {
    telegramService.sendScreen.mockRejectedValue(new ChatUnreachableError('blocked'));

    await processor.process(job());

    expect(channelService.updateReachable).toHaveBeenCalledWith(Channel.TELEGRAM, '1001', false);
    expect(deliveryService.markFailed).toHaveBeenCalledWith('delivery-1', 'blocked');
  });

  it('fails a refused message without retries', async () => {
    telegramService.sendScreen.mockRejectedValue(
      new TelegramRejectedError('400', 400, 'Bad Request: can not parse entities'),
    );

    await processor.process(job());

    expect(deliveryService.markFailed).toHaveBeenCalledWith('delivery-1', '400');
    expect(channelService.updateReachable).not.toHaveBeenCalled();
  });

  it('retries a network error and fails the delivery after the last attempt', async () => {
    telegramService.sendScreen.mockRejectedValue(new TelegramRetryableError('timeout'));

    await expect(processor.process(job(0))).rejects.toThrow('timeout');
    expect(deliveryService.markFailed).not.toHaveBeenCalled();

    await expect(processor.process(job(4))).rejects.toThrow('timeout');
    expect(deliveryService.markFailed).toHaveBeenCalledWith('delivery-1', 'timeout');
  });
});
