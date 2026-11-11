import type { ConfigService } from '@nestjs/config';
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
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { DeliveryMode } from 'src/modules/infrastructure/config/types/config.enums';
import type { DeliveryQueueProducer } from 'src/modules/queue/delivery/delivery-queue.producer';
import type { BotService } from '../../bot.service';
import type { AccessService } from '../../core/access.service';
import { ReportDeliveryMessages } from '../constants/report-delivery.messages';
import { ReportDelivery } from '../report.delivery';
import { ReportView } from '../report.view';

const DELIVERY = {
  id: 'delivery-1',
  userId: 'user-1',
  reportId: 'report-1',
  status: DeliveryStatus.QUEUED,
  redirected: false,
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
  const accessService = { findOwnerIds: vi.fn<AccessService['findOwnerIds']>() };
  const create = (mode: DeliveryMode) =>
    new ReportDelivery(
      deliveryService as unknown as DeliveryService,
      producer as unknown as DeliveryQueueProducer,
      reportService as unknown as ReportService,
      userService as unknown as UserService,
      channelService as unknown as ChannelService,
      botService as unknown as BotService,
      accessService as unknown as AccessService,
      new I18nService(),
      new ReportView(),
      { get: () => mode } as unknown as ConfigService<AppEnvs, true>,
    );
  const delivery = create(DeliveryMode.LIVE);

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

  describe('queue', () => {
    it('queues the report to the channel it was asked in', async () => {
      deliveryService.createForReport.mockResolvedValue({ id: 'delivery-4' } as Delivery);

      await delivery.queue(REPORT, Channel.SLACK, true);

      expect(deliveryService.createForReport).toHaveBeenCalledWith(REPORT, Channel.SLACK, false);
      expect(producer.addDelivery).toHaveBeenCalledExactlyOnceWith(Channel.SLACK, 'delivery-4');
      expect(channelService.findReceiving).not.toHaveBeenCalled();
    });

    it('queues a report without a channel to every reachable configured channel', async () => {
      channelService.findReceiving.mockResolvedValue([
        { channel: Channel.TELEGRAM },
        { channel: Channel.SLACK },
      ] as UserChannel[]);
      botService.listChannels.mockReturnValue([Channel.TELEGRAM, Channel.SLACK]);
      deliveryService.createForReport
        .mockResolvedValueOnce({ id: 'delivery-5' } as Delivery)
        .mockResolvedValueOnce({ id: 'delivery-6' } as Delivery);

      await delivery.queue(REPORT, null, false);

      expect(channelService.findReceiving).toHaveBeenCalledWith('user-1', [
        Channel.TELEGRAM,
        Channel.SLACK,
      ]);
      expect(producer.addDelivery.mock.calls).toEqual([
        [Channel.TELEGRAM, 'delivery-5'],
        [Channel.SLACK, 'delivery-6'],
      ]);
    });

    it('queues nothing when no channel of the employee gets reports', async () => {
      channelService.findReceiving.mockResolvedValue([]);
      botService.listChannels.mockReturnValue([Channel.TELEGRAM]);

      await delivery.queue(REPORT, null, false);

      expect(deliveryService.createForReport).not.toHaveBeenCalled();
    });

    it('redirects only the reports the employee did not ask for in the redirect mode', async () => {
      deliveryService.createForReport.mockResolvedValue({ id: 'delivery-3' } as Delivery);
      const redirecting = create(DeliveryMode.REDIRECT);

      await redirecting.queue(REPORT, Channel.TELEGRAM, false);
      await redirecting.queue(REPORT, Channel.TELEGRAM, true);

      expect(
        deliveryService.createForReport.mock.calls.map(([, , redirected]) => redirected),
      ).toEqual([true, false]);
    });
  });

  describe('prepare', () => {
    it('prepares the report screen for the chat of the employee in the channel', async () => {
      const plan = await delivery.prepare('delivery-1', Channel.TELEGRAM);

      expect(plan).toEqual({
        deliveryId: 'delivery-1',
        reportId: 'report-1',
        chatIds: ['1001'],
        redirected: false,
        screen: {
          text: REPORT.content,
          buttons: [[{ text: 'Пересобрать', data: 'rpt:rebuild:2026-11-09' }]],
        },
      });
      expect(deliveryService.countAttempt).toHaveBeenCalledWith('delivery-1');
      expect((await delivery.prepare('delivery-1', Channel.SLACK))?.chatIds).toEqual(['U0EMPLOY1']);
    });

    it('prepares a redirected report for every owner of the channel without buttons', async () => {
      deliveryService.findById.mockResolvedValue({ ...DELIVERY, redirected: true });
      accessService.findOwnerIds.mockReturnValue(['100', '101']);

      const plan = await delivery.prepare('delivery-1', Channel.TELEGRAM);

      expect(accessService.findOwnerIds).toHaveBeenCalledWith(Channel.TELEGRAM);
      expect(plan?.chatIds).toEqual(['100', '101']);
      expect(plan?.screen).toEqual({
        text: [
          new I18nService().getLocale(Language.RU).delivery.redirected('Анна\\_С'),
          '',
          REPORT.content,
        ].join('\n'),
      });
      expect(channelService.findByUser).not.toHaveBeenCalled();
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
