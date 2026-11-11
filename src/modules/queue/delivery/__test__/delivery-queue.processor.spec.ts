import { type Job, RateLimitError } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatUnreachableError } from 'src/common/channel/chat-unreachable.error';
import { Channel } from 'src/common/channel/types/channel.enums';
import type { ReportDelivery } from 'src/modules/application/bot/report/report.delivery';
import type { ReportDeliveryPlan } from 'src/modules/application/bot/report/types/report-delivery.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { SlackRejectedError } from 'src/modules/vendors/slack/slack.error';
import type { SlackService } from 'src/modules/vendors/slack/slack.service';
import {
  TelegramRejectedError,
  TelegramRetryableError,
} from 'src/modules/vendors/telegram/telegram.error';
import type { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { DELIVERY_BROADCAST_JOB, DELIVERY_SEND_JOB } from '../constants/delivery-queue.constants';
import { DeliverySlackQueueProcessor } from '../delivery-slack-queue.processor';
import { DeliveryTelegramQueueProcessor } from '../delivery-telegram-queue.processor';

const PLAN: ReportDeliveryPlan = {
  deliveryId: 'delivery-1',
  reportId: 'report-1',
  chatIds: ['1001'],
  redirected: false,
  screen: { text: 'project:\n• Fixed a bug' },
};

function job(attemptsMade = 0) {
  return {
    name: DELIVERY_SEND_JOB,
    data: { deliveryId: 'delivery-1' },
    attemptsMade,
    opts: { attempts: 5 },
  } as unknown as Job;
}

function broadcastJob(attemptsMade = 0) {
  return {
    id: 'broadcast-b-1-2001',
    name: DELIVERY_BROADCAST_JOB,
    data: { chatId: '2001', text: 'Standup at 11' },
    attemptsMade,
    opts: { attempts: 5 },
  } as unknown as Job;
}

describe('DeliveryQueueProcessor', () => {
  const reportDelivery = {
    prepare: vi.fn<ReportDelivery['prepare']>(),
    markSent: vi.fn<ReportDelivery['markSent']>(),
    markFailed: vi.fn<ReportDelivery['markFailed']>(),
  };
  const channelService = { updateReachable: vi.fn<ChannelService['updateReachable']>() };
  const telegramService = {
    channel: Channel.TELEGRAM,
    sendScreen: vi.fn<TelegramService['sendScreen']>(),
  };
  const worker = { rateLimit: vi.fn() };
  const processor = new DeliveryTelegramQueueProcessor(
    reportDelivery as unknown as ReportDelivery,
    channelService as unknown as ChannelService,
    telegramService as unknown as TelegramService,
  );
  Object.defineProperty(processor, 'worker', { get: () => worker });

  beforeEach(() => {
    vi.resetAllMocks();
    reportDelivery.prepare.mockResolvedValue(PLAN);
  });

  it('sends the report to its chat in the channel of the queue and marks it sent', async () => {
    telegramService.sendScreen.mockResolvedValue('300000007');

    await processor.process(job());

    expect(reportDelivery.prepare).toHaveBeenCalledWith('delivery-1', Channel.TELEGRAM);
    expect(telegramService.sendScreen).toHaveBeenCalledWith('1001', PLAN.screen);
    expect(reportDelivery.markSent).toHaveBeenCalledWith(PLAN, '300000007');
  });

  it('sends a redirected report to every owner and keeps the first message', async () => {
    reportDelivery.prepare.mockResolvedValue({
      ...PLAN,
      chatIds: ['100', '101'],
      redirected: true,
    });
    telegramService.sendScreen.mockResolvedValueOnce('500').mockResolvedValueOnce('501');

    await processor.process(job());

    expect(telegramService.sendScreen.mock.calls.map(([chatId]) => chatId)).toEqual(['100', '101']);
    expect(reportDelivery.markSent).toHaveBeenCalledWith(expect.anything(), '500');
  });

  it('sends nothing when the delivery has nothing to send', async () => {
    reportDelivery.prepare.mockResolvedValue(null);

    await processor.process(job());

    expect(telegramService.sendScreen).not.toHaveBeenCalled();
    expect(reportDelivery.markSent).not.toHaveBeenCalled();
  });

  it('marks the chat unreachable when the bot is blocked and does not retry', async () => {
    telegramService.sendScreen.mockRejectedValue(new ChatUnreachableError('blocked'));

    await processor.process(job());

    expect(channelService.updateReachable).toHaveBeenCalledWith(Channel.TELEGRAM, '1001', false);
    expect(reportDelivery.markFailed).toHaveBeenCalledWith(PLAN, 'blocked');
  });

  it('keeps the chat of the employee reachable when an owner blocked the bot', async () => {
    reportDelivery.prepare.mockResolvedValue({ ...PLAN, chatIds: ['100'], redirected: true });
    telegramService.sendScreen.mockRejectedValue(new ChatUnreachableError('blocked'));

    await processor.process(job());

    expect(channelService.updateReachable).not.toHaveBeenCalled();
    expect(reportDelivery.markFailed).toHaveBeenCalledWith(expect.anything(), 'blocked');
  });

  it('fails a refused message without retries', async () => {
    telegramService.sendScreen.mockRejectedValue(
      new TelegramRejectedError('400', 400, 'Bad Request: can not parse entities'),
    );

    await processor.process(job());

    expect(reportDelivery.markFailed).toHaveBeenCalledWith(PLAN, '400');
    expect(channelService.updateReachable).not.toHaveBeenCalled();
  });

  it('retries a network error and fails the delivery after the last attempt', async () => {
    telegramService.sendScreen.mockRejectedValue(new TelegramRetryableError('timeout'));

    await expect(processor.process(job(0))).rejects.toThrow('timeout');
    expect(reportDelivery.markFailed).not.toHaveBeenCalled();

    await expect(processor.process(job(4))).rejects.toThrow('timeout');
    expect(reportDelivery.markFailed).toHaveBeenCalledWith(PLAN, 'timeout');
  });

  it('pauses the whole Telegram queue for retry_after without spending the attempt', async () => {
    telegramService.sendScreen.mockRejectedValue(new TelegramRetryableError('429', 7));

    await expect(processor.process(job())).rejects.toBeInstanceOf(RateLimitError);

    expect(worker.rateLimit).toHaveBeenCalledWith(7000);
    expect(reportDelivery.markFailed).not.toHaveBeenCalled();
  });

  it('sends a broadcast message to its chat without touching deliveries', async () => {
    await processor.process(broadcastJob());

    expect(telegramService.sendScreen).toHaveBeenCalledWith('2001', { text: 'Standup at 11' });
    expect(reportDelivery.prepare).not.toHaveBeenCalled();
  });

  it('pauses the queue for a broadcast message on 429', async () => {
    telegramService.sendScreen.mockRejectedValue(new TelegramRetryableError('429', 3));

    await expect(processor.process(broadcastJob())).rejects.toBeInstanceOf(RateLimitError);
    expect(worker.rateLimit).toHaveBeenCalledWith(3000);
  });

  it('marks the chat of a broadcast message unreachable and does not retry', async () => {
    telegramService.sendScreen.mockRejectedValue(new ChatUnreachableError('blocked'));

    await expect(processor.process(broadcastJob())).resolves.toBeUndefined();
    expect(channelService.updateReachable).toHaveBeenCalledWith(Channel.TELEGRAM, '2001', false);
  });

  it('drops a refused broadcast message and retries one with a network error', async () => {
    telegramService.sendScreen.mockRejectedValueOnce(new TelegramRejectedError('400', 400, ''));
    await expect(processor.process(broadcastJob())).resolves.toBeUndefined();

    telegramService.sendScreen.mockRejectedValueOnce(new TelegramRetryableError('timeout'));
    await expect(processor.process(broadcastJob(4))).rejects.toThrow('timeout');
  });

  it('refuses an unknown job', async () => {
    await expect(processor.process({ name: 'other', data: {} } as unknown as Job)).rejects.toThrow(
      'Unknown delivery job: other',
    );
  });

  describe('in Slack', () => {
    const slackService = {
      channel: Channel.SLACK,
      sendScreen: vi.fn<SlackService['sendScreen']>(),
    };
    const slackProcessor = new DeliverySlackQueueProcessor(
      reportDelivery as unknown as ReportDelivery,
      channelService as unknown as ChannelService,
      slackService as unknown as SlackService,
    );

    it('prepares the delivery for Slack and sends it through Slack', async () => {
      reportDelivery.prepare.mockResolvedValue({ ...PLAN, chatIds: ['U0EMPLOY1'] });
      slackService.sendScreen.mockResolvedValue('1731240000.000100');

      await slackProcessor.process(job());

      expect(reportDelivery.prepare).toHaveBeenCalledWith('delivery-1', Channel.SLACK);
      expect(slackService.sendScreen).toHaveBeenCalledWith('U0EMPLOY1', PLAN.screen);
      expect(reportDelivery.markSent).toHaveBeenCalledWith(expect.anything(), '1731240000.000100');
    });

    it('fails a message Slack refused and marks a Slack chat it cannot reach', async () => {
      reportDelivery.prepare.mockResolvedValue({ ...PLAN, chatIds: ['U0EMPLOY1'] });
      slackService.sendScreen.mockRejectedValueOnce(
        new SlackRejectedError('Slack rejected the request: invalid_blocks', 'invalid_blocks'),
      );
      await slackProcessor.process(job());
      expect(reportDelivery.markFailed).toHaveBeenCalledWith(
        expect.anything(),
        'Slack rejected the request: invalid_blocks',
      );

      slackService.sendScreen.mockRejectedValueOnce(new ChatUnreachableError('user_not_found'));
      await slackProcessor.process(job());
      expect(channelService.updateReachable).toHaveBeenCalledWith(
        Channel.SLACK,
        'U0EMPLOY1',
        false,
      );
    });
  });
});
