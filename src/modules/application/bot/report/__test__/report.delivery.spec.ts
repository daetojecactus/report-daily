import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { DeliveryStatus } from 'src/modules/application/delivery/types/delivery.enums';
import type { Delivery } from 'src/modules/application/delivery/types/delivery.interface';
import type { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { Report } from 'src/modules/application/report/types/report.interface';
import type { ReportService } from 'src/modules/application/report/report.service';
import type { UserChannel } from 'src/modules/application/user/channel/types/channel.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import type { User } from 'src/modules/application/user/types/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { DeliveryQueueProducer } from 'src/modules/queue/delivery/delivery-queue.producer';
import type { BotService } from '../../bot.service';
import { ReportDeliveryMessages } from '../constants/report-delivery.messages';
import { ReportDelivery } from '../report.delivery';
import { ReportView } from '../report.view';

const DELIVERY = {
  id: 'delivery-1',
  userId: 'user-1',
  reportId: 'report-1',
  status: DeliveryStatus.QUEUED,
} as Delivery;

const REPORT = {
  id: 'report-1',
  userId: 'user-1',
  reportDate: '2026-11-09',
  content: 'project:\n• Fixed a bug',
} as Report;

describe('ReportDelivery', () => {
  const deliveryService = {
    findById: vi.fn<DeliveryService['findById']>(),
    findForReport: vi.fn<DeliveryService['findForReport']>(),
    createForReport: vi.fn<DeliveryService['createForReport']>(),
    countAttempt: vi.fn<DeliveryService['countAttempt']>(),
    markSent: vi.fn<DeliveryService['markSent']>(),
    markFailed: vi.fn<DeliveryService['markFailed']>(),
  };
  const producer = { addDelivery: vi.fn<DeliveryQueueProducer['addDelivery']>() };
  const reportService = {
    findById: vi.fn<ReportService['findById']>(),
    markDelivered: vi.fn<ReportService['markDelivered']>(),
  };
  const userService = { findById: vi.fn<UserService['findById']>() };
  const channelService = {
    findByUser: vi.fn<ChannelService['findByUser']>(),
    findReceiving: vi.fn<ChannelService['findReceiving']>(),
  };
  const botService = { listChannels: vi.fn<BotService['listChannels']>() };
  const delivery = new ReportDelivery(
    deliveryService as unknown as DeliveryService,
    producer as unknown as DeliveryQueueProducer,
    reportService as unknown as ReportService,
    userService as unknown as UserService,
    channelService as unknown as ChannelService,
    botService as unknown as BotService,
    new I18nService(),
    new ReportView(),
  );

  beforeEach(() => {
    vi.resetAllMocks();
    deliveryService.findById.mockResolvedValue(DELIVERY);
    reportService.findById.mockResolvedValue(REPORT);
    channelService.findByUser.mockResolvedValue([
      { channel: Channel.TELEGRAM, externalId: '1001' },
      { channel: Channel.SLACK, externalId: 'U0EMPLOY1' },
    ] as UserChannel[]);
    userService.findById.mockResolvedValue({
      language: Language.RU,
      displayName: 'Анна_С',
    } as User);
  });

  describe('findChannels', () => {
    it('takes the channel the report was asked in', async () => {
      expect(await delivery.findChannels('user-1', Channel.SLACK)).toEqual([Channel.SLACK]);
      expect(channelService.findReceiving).not.toHaveBeenCalled();
    });

    it('takes every reachable configured channel the employee gets reports in', async () => {
      channelService.findReceiving.mockResolvedValue([
        { channel: Channel.TELEGRAM },
        { channel: Channel.SLACK },
      ] as UserChannel[]);
      botService.listChannels.mockReturnValue([Channel.TELEGRAM, Channel.SLACK]);

      expect(await delivery.findChannels('user-1', null)).toEqual([
        Channel.TELEGRAM,
        Channel.SLACK,
      ]);
      expect(channelService.findReceiving).toHaveBeenCalledWith('user-1', [
        Channel.TELEGRAM,
        Channel.SLACK,
      ]);
    });

    it('finds no channel when none of the employee gets reports', async () => {
      channelService.findReceiving.mockResolvedValue([]);
      botService.listChannels.mockReturnValue([Channel.TELEGRAM]);

      expect(await delivery.findChannels('user-1', null)).toEqual([]);
    });
  });

  describe('queue', () => {
    const JOB_CREATED_AT = new Date('2026-11-10T09:00:00Z');

    it('creates a delivery per channel and queues it', async () => {
      deliveryService.findForReport.mockResolvedValue(null as unknown as Delivery);
      deliveryService.createForReport
        .mockResolvedValueOnce({ id: 'delivery-5' } as Delivery)
        .mockResolvedValueOnce({ id: 'delivery-6' } as Delivery);

      await delivery.queue(REPORT, [Channel.TELEGRAM, Channel.SLACK], JOB_CREATED_AT);

      expect(deliveryService.createForReport.mock.calls).toEqual([
        [REPORT, Channel.TELEGRAM],
        [REPORT, Channel.SLACK],
      ]);
      expect(producer.addDelivery.mock.calls).toEqual([
        [Channel.TELEGRAM, 'delivery-5'],
        [Channel.SLACK, 'delivery-6'],
      ]);
    });

    it('reuses the delivery a failed attempt of the same job already created', async () => {
      deliveryService.findForReport
        .mockResolvedValueOnce({ id: 'delivery-5' } as Delivery)
        .mockResolvedValueOnce(null as unknown as Delivery);
      deliveryService.createForReport.mockResolvedValueOnce({ id: 'delivery-6' } as Delivery);

      await delivery.queue(REPORT, [Channel.TELEGRAM, Channel.SLACK], JOB_CREATED_AT);

      expect(deliveryService.findForReport).toHaveBeenCalledWith(
        'report-1',
        Channel.TELEGRAM,
        JOB_CREATED_AT,
      );
      expect(deliveryService.createForReport).toHaveBeenCalledExactlyOnceWith(
        REPORT,
        Channel.SLACK,
      );
      expect(producer.addDelivery.mock.calls).toEqual([
        [Channel.TELEGRAM, 'delivery-5'],
        [Channel.SLACK, 'delivery-6'],
      ]);
    });
  });

  describe('prepare', () => {
    it('prepares the report screen for the chat of the employee in the channel', async () => {
      const plan = await delivery.prepare('delivery-1', Channel.TELEGRAM);

      expect(plan).toEqual({
        deliveryId: 'delivery-1',
        reportId: 'report-1',
        chatId: '1001',
        screen: {
          text: REPORT.content,
          buttons: [[{ text: 'Пересобрать', data: 'rpt:rebuild:2026-11-09' }]],
        },
      });
      expect(deliveryService.countAttempt).toHaveBeenCalledWith('delivery-1');
      expect((await delivery.prepare('delivery-1', Channel.SLACK))?.chatId).toBe('U0EMPLOY1');
    });

    it('skips a delivery that is gone or already handled', async () => {
      deliveryService.findById.mockResolvedValueOnce(null as unknown as Delivery);
      expect(await delivery.prepare('delivery-1', Channel.TELEGRAM)).toBeNull();

      deliveryService.findById.mockResolvedValueOnce({ ...DELIVERY, status: DeliveryStatus.SENT });
      expect(await delivery.prepare('delivery-1', Channel.TELEGRAM)).toBeNull();

      expect(deliveryService.markFailed).not.toHaveBeenCalled();
      expect(deliveryService.countAttempt).not.toHaveBeenCalled();
    });

    it('fails a delivery without a text or a chat in the channel', async () => {
      channelService.findByUser.mockResolvedValue([]);

      expect(await delivery.prepare('delivery-1', Channel.TELEGRAM)).toBeNull();

      expect(deliveryService.markFailed).toHaveBeenCalledWith(
        'delivery-1',
        ReportDeliveryMessages.NOTHING_TO_SEND,
      );
      expect(deliveryService.countAttempt).not.toHaveBeenCalled();
    });
  });

  it('marks the delivery and the report when the report is sent', async () => {
    const plan = await delivery.prepare('delivery-1', Channel.TELEGRAM);

    await delivery.markSent(plan!, '300000007');

    expect(deliveryService.markSent).toHaveBeenCalledWith('delivery-1', '300000007');
    expect(reportService.markDelivered).toHaveBeenCalledWith('report-1');
  });
});
