import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatEvent } from 'src/common/channel/types/chat-channel.interface';
import { INBOUND_EVENT_JOB } from '../constants/inbound-queue.constants';
import { InboundQueueProducer } from '../inbound-queue.producer';

const event: ChatEvent = {
  channel: Channel.TELEGRAM,
  userId: '1001',
  chatId: '1001',
  languageCode: 'en',
  input: { type: ChatInputType.COMMAND, command: 'start' },
};

function createProducer() {
  const queue = { add: vi.fn<Queue['add']>() };
  const producer = new InboundQueueProducer(queue as unknown as Queue);
  return { queue, producer };
}

describe('InboundQueueProducer', () => {
  it('adds a Telegram event without retries under its update id', async () => {
    const { queue, producer } = createProducer();

    await producer.addTelegramEvent(42, event);

    expect(queue.add).toHaveBeenCalledWith(
      INBOUND_EVENT_JOB,
      { event },
      { attempts: 1, jobId: 'tg-42' },
    );
  });

  it('adds a Slack event under its own key', async () => {
    const { queue, producer } = createProducer();
    const slackEvent = { ...event, channel: Channel.SLACK, userId: 'U0EMPLOY1' };

    await producer.addSlackEvent('Ev01', slackEvent);

    expect(queue.add).toHaveBeenCalledWith(
      INBOUND_EVENT_JOB,
      { event: slackEvent },
      { attempts: 1, jobId: 'slack-Ev01' },
    );
  });

  it('uses a job id that BullMQ accepts', async () => {
    const { queue, producer } = createProducer();

    await producer.addTelegramEvent(42, event);

    const [, , options] = queue.add.mock.calls[0];
    expect(options?.jobId).not.toContain(':');
    expect(options?.jobId).not.toMatch(/^\d+$/);
  });
});
