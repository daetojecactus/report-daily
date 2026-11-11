import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatUnreachableError } from 'src/common/channel/chat-unreachable.error';
import { ReportView } from 'src/modules/application/bot/report/report.view';
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
import { SlackRejectedError } from 'src/modules/vendors/slack/slack.error';
import type { SlackService } from 'src/modules/vendors/slack/slack.service';
import {
  DELIVERY_SLACK_BROADCAST_JOB,
  DELIVERY_SLACK_SEND_JOB,
} from '../constants/delivery-slack-queue.constants';
import { DeliverySlackQueueMessages } from '../constants/delivery-slack-queue.messages';
import { DeliverySlackQueueProcessor } from '../delivery-slack-queue.processor';

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

const CHATS = [
  { channel: Channel.TELEGRAM, externalId: '1001' },
  { channel: Channel.SLACK, externalId: 'U0ANNA01' },
] as UserChannel[];

function job(attemptsMade = 0, name = DELIVERY_SLACK_SEND_JOB) {
  return {
    name,
    data: { deliveryId: 'delivery-1' },
    attemptsMade,
    opts: { attempts: 5 },
  } as unknown as Job;
}

function broadcastJob() {
  return {
    id: 'broadcast-b-1-U0ANNA01',
    name: DELIVERY_SLACK_BROADCAST_JOB,
    data: { chatId: 'U0ANNA01', text: 'Standup at 11' },
    attemptsMade: 0,
    opts: { attempts: 5 },
  } as unknown as Job;
}

describe('DeliverySlackQueueProcessor', () => {
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
  const slackService = { sendScreen: vi.fn<SlackService['sendScreen']>() };
  const userService = { findById: vi.fn<UserService['findById']>() };
  const processor = new DeliverySlackQueueProcessor(
    deliveryService as unknown as DeliveryService,
    reportService as unknown as ReportService,
    channelService as unknown as ChannelService,
    userService as unknown as UserService,
    slackService as unknown as SlackService,
    new ReportView(),
    new I18nService(),
    { get: () => ['U0OWNER1', 'U0OWNER2'] } as unknown as ConfigService<AppEnvs, true>,
  );

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    deliveryService.findById.mockResolvedValue(DELIVERY);
    reportService.findById.mockResolvedValue(REPORT);
    channelService.findByUser.mockResolvedValue(CHATS);
    userService.findById.mockResolvedValue({
      language: Language.RU,
      displayName: 'Анна_С',
    } as User);
  });

  it('sends the report to the Slack of the employee and marks the delivery and the report', async () => {
    slackService.sendScreen.mockResolvedValue('1731240000.000100');

    await processor.process(job());

    expect(deliveryService.countAttempt).toHaveBeenCalledWith('delivery-1');
    expect(slackService.sendScreen).toHaveBeenCalledWith('U0ANNA01', {
      text: REPORT.content,
      buttons: [[{ text: 'Пересобрать', data: 'rpt:rebuild:2026-11-09' }]],
    });
    expect(deliveryService.markSent).toHaveBeenCalledWith('delivery-1', '1731240000.000100');
    expect(reportService.markDelivered).toHaveBeenCalledWith('report-1');
  });

  it('sends a redirected report to every Slack owner with whom it was for', async () => {
    deliveryService.findById.mockResolvedValue({ ...DELIVERY, redirected: true });
    slackService.sendScreen.mockResolvedValueOnce('1.1').mockResolvedValueOnce('1.2');
    const text = [
      new I18nService().getLocale(Language.RU).delivery.redirected('Анна\\_С'),
      '',
      REPORT.content,
    ].join('\n');

    await processor.process(job());

    expect(slackService.sendScreen.mock.calls).toEqual([
      ['U0OWNER1', { text }],
      ['U0OWNER2', { text }],
    ]);
    expect(channelService.findByUser).not.toHaveBeenCalled();
    expect(deliveryService.markSent).toHaveBeenCalledWith('delivery-1', '1.1');
  });

  it('skips a delivery that is gone or already handled', async () => {
    deliveryService.findById.mockResolvedValueOnce(null as unknown as Delivery);
    await processor.process(job());
    deliveryService.findById.mockResolvedValueOnce({ ...DELIVERY, status: DeliveryStatus.SENT });
    await processor.process(job());

    expect(slackService.sendScreen).not.toHaveBeenCalled();
    expect(deliveryService.markFailed).not.toHaveBeenCalled();
  });

  it('fails a delivery when the employee has no Slack', async () => {
    channelService.findByUser.mockResolvedValue([CHATS[0]]);

    await processor.process(job());

    expect(slackService.sendScreen).not.toHaveBeenCalled();
    expect(deliveryService.markFailed).toHaveBeenCalledWith(
      'delivery-1',
      DeliverySlackQueueMessages.NOTHING_TO_SEND,
    );
  });

  it('marks the Slack of a member who left unreachable and does not retry', async () => {
    slackService.sendScreen.mockRejectedValue(new ChatUnreachableError('user_not_found'));

    await expect(processor.process(job())).resolves.toBeUndefined();

    expect(channelService.updateReachable).toHaveBeenCalledWith(Channel.SLACK, 'U0ANNA01', false);
    expect(deliveryService.markFailed).toHaveBeenCalledWith('delivery-1', 'user_not_found');
  });

  it('fails a message Slack rejected without retries', async () => {
    slackService.sendScreen.mockRejectedValue(
      new SlackRejectedError('Slack rejected the request: invalid_blocks', 'invalid_blocks'),
    );

    await expect(processor.process(job())).resolves.toBeUndefined();

    expect(deliveryService.markFailed).toHaveBeenCalledWith(
      'delivery-1',
      'Slack rejected the request: invalid_blocks',
    );
    expect(channelService.updateReachable).not.toHaveBeenCalled();
  });

  it('retries a network error and fails the delivery after the last attempt', async () => {
    slackService.sendScreen.mockRejectedValue(new Error('socket hang up'));

    await expect(processor.process(job(0))).rejects.toThrow('socket hang up');
    expect(deliveryService.markFailed).not.toHaveBeenCalled();

    await expect(processor.process(job(4))).rejects.toThrow('socket hang up');
    expect(deliveryService.markFailed).toHaveBeenCalledWith('delivery-1', 'socket hang up');
  });

  it('sends a broadcast message to its chat without touching deliveries', async () => {
    slackService.sendScreen.mockResolvedValue('1.1');

    await processor.process(broadcastJob());

    expect(slackService.sendScreen).toHaveBeenCalledWith('U0ANNA01', { text: 'Standup at 11' });
    expect(deliveryService.findById).not.toHaveBeenCalled();
  });

  it('marks the chat of a broadcast message unreachable and does not retry a refusal', async () => {
    slackService.sendScreen.mockRejectedValueOnce(new ChatUnreachableError('user_not_found'));
    await expect(processor.process(broadcastJob())).resolves.toBeUndefined();
    expect(channelService.updateReachable).toHaveBeenCalledWith(Channel.SLACK, 'U0ANNA01', false);

    slackService.sendScreen.mockRejectedValueOnce(
      new SlackRejectedError('Slack rejected the request: invalid_blocks', 'invalid_blocks'),
    );
    await expect(processor.process(broadcastJob())).resolves.toBeUndefined();
    expect(channelService.updateReachable).toHaveBeenCalledOnce();
  });

  it('retries a broadcast message on a network error', async () => {
    slackService.sendScreen.mockRejectedValue(new Error('socket hang up'));

    await expect(processor.process(broadcastJob())).rejects.toThrow('socket hang up');
  });

  it('refuses an unknown job', async () => {
    await expect(processor.process(job(0, 'other'))).rejects.toThrow(
      DeliverySlackQueueMessages.UNKNOWN_JOB,
    );
  });
});
