import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatEvent } from 'src/common/channel/types/chat-channel.interface';
import type { BotService } from 'src/modules/application/bot/bot.service';
import { INBOUND_EVENT_JOB } from '../constants/inbound-queue.constants';
import { InboundQueueMessages } from '../constants/inbound-queue.messages';
import { InboundQueueProcessor } from '../inbound-queue.processor';

const event: ChatEvent = {
  channel: Channel.TELEGRAM,
  userId: '1001',
  chatId: '1001',
  languageCode: 'en',
  input: { type: ChatInputType.COMMAND, command: 'start' },
};

function createProcessor() {
  const botService = {
    handle: vi.fn<BotService['handle']>(),
    replyFailure: vi.fn<BotService['replyFailure']>(),
  };
  const processor = new InboundQueueProcessor(botService as unknown as BotService);
  return { botService, processor };
}

function createJob(name: string) {
  return { name, id: 'tg-1', data: { event } } as Job;
}

describe('InboundQueueProcessor', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes an event to the bot', async () => {
    const { botService, processor } = createProcessor();

    await expect(processor.process(createJob(INBOUND_EVENT_JOB))).resolves.toBeUndefined();

    expect(botService.handle).toHaveBeenCalledWith(event);
    expect(botService.replyFailure).not.toHaveBeenCalled();
  });

  it('logs a failed event with the job id and replies with an error', async () => {
    const { botService, processor } = createProcessor();
    const logError = vi.spyOn(Logger.prototype, 'error');
    botService.handle.mockRejectedValue(new Error('handler crashed'));

    await expect(processor.process(createJob(INBOUND_EVENT_JOB))).resolves.toBeUndefined();

    expect(botService.replyFailure).toHaveBeenCalledWith(event);
    expect(logError).toHaveBeenCalledWith(
      { jobId: 'tg-1', error: 'handler crashed' },
      InboundQueueMessages.EVENT_FAILED,
    );
  });

  it('fails the job when the error reply fails too', async () => {
    const { botService, processor } = createProcessor();
    const replyError = new Error('chat is down');
    botService.handle.mockRejectedValue(new Error('handler crashed'));
    botService.replyFailure.mockRejectedValue(replyError);

    await expect(processor.process(createJob(INBOUND_EVENT_JOB))).rejects.toBe(replyError);
  });

  it('rejects an unknown job', async () => {
    const { botService, processor } = createProcessor();

    await expect(processor.process(createJob('unknown'))).rejects.toThrow(
      `${InboundQueueMessages.UNKNOWN_JOB}: unknown`,
    );
    expect(botService.handle).not.toHaveBeenCalled();
  });
});
