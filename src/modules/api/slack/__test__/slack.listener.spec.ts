import { Logger } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import { Channel } from 'src/common/channel/types/channel.enums';
import type { ChatEvent } from 'src/common/channel/types/chat-channel.interface';
import type { InboundQueueProducer } from 'src/modules/queue/inbound/inbound-queue.producer';
import type { SlackService } from 'src/modules/vendors/slack/slack.service';
import type { SlackSocket } from 'src/modules/vendors/slack/slack.socket';
import { SlackListener } from '../slack.listener';

const EVENT: ChatEvent = {
  channel: Channel.SLACK,
  userId: 'U0EMPLOY1',
  chatId: 'D100',
  languageCode: null,
  input: { type: ChatInputType.COMMAND, command: 'report' },
};

describe('SlackListener', () => {
  const socket = {
    isEnabled: vi.fn<SlackSocket['isEnabled']>(),
    listen: vi.fn<SlackSocket['listen']>(),
    close: vi.fn<SlackSocket['close']>(),
  };
  const slackService = {
    isEnabled: vi.fn<SlackService['isEnabled']>(),
    toChatEvent: vi.fn<SlackService['toChatEvent']>(),
    findEventId: vi.fn<SlackService['findEventId']>(),
  };
  const producer = { addSlackEvent: vi.fn<InboundQueueProducer['addSlackEvent']>() };
  const listener = new SlackListener(
    socket as unknown as SlackSocket,
    slackService as unknown as SlackService,
    producer as unknown as InboundQueueProducer,
  );
  const ack = vi.fn(() => Promise.resolve());
  const envelope = { type: 'events_api', body: {}, envelopeId: 'env-1', ack };

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    ack.mockResolvedValue(undefined);
    socket.listen.mockResolvedValue(undefined);
  });

  it('listens only when Slack is configured', () => {
    socket.isEnabled.mockReturnValue(false);
    slackService.isEnabled.mockReturnValue(true);
    listener.onApplicationBootstrap();
    expect(socket.listen).not.toHaveBeenCalled();

    socket.isEnabled.mockReturnValue(true);
    listener.onApplicationBootstrap();
    expect(socket.listen).toHaveBeenCalledOnce();
  });

  it('queues an event under the Slack event id and then acknowledges it', async () => {
    slackService.toChatEvent.mockReturnValue(EVENT);
    slackService.findEventId.mockReturnValue('Ev01');

    await listener.receive(envelope);

    expect(producer.addSlackEvent).toHaveBeenCalledWith('Ev01', EVENT);
    expect(ack).toHaveBeenCalledOnce();
    expect(producer.addSlackEvent.mock.invocationCallOrder[0]).toBeLessThan(
      ack.mock.invocationCallOrder[0],
    );
  });

  it('uses the envelope id without an event id and acknowledges what it ignores', async () => {
    slackService.toChatEvent.mockReturnValueOnce(EVENT).mockReturnValueOnce(null);
    slackService.findEventId.mockReturnValue(null);

    await listener.receive(envelope);
    await listener.receive(envelope);

    expect(producer.addSlackEvent).toHaveBeenCalledOnce();
    expect(producer.addSlackEvent).toHaveBeenCalledWith('env-1', EVENT);
    expect(ack).toHaveBeenCalledTimes(2);
  });

  it('does not acknowledge an event it could not queue, so Slack sends it again', async () => {
    slackService.toChatEvent.mockReturnValue(EVENT);
    producer.addSlackEvent.mockRejectedValue(new Error('Redis is down'));

    await expect(listener.receive(envelope)).resolves.toBeUndefined();
    expect(ack).not.toHaveBeenCalled();
  });

  it('closes the connection on shutdown', async () => {
    await listener.onModuleDestroy();

    expect(socket.close).toHaveBeenCalledOnce();
  });
});
