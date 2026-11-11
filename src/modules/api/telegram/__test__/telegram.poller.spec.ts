import { describe, expect, it, vi } from 'vitest';
import type { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import type { InboundQueueProducer } from 'src/modules/queue/inbound/inbound-queue.producer';
import type { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { TelegramPoller } from '../telegram.poller';

describe('TelegramPoller', () => {
  it('does not poll when Telegram is not configured', async () => {
    const telegramService = { isEnabled: () => false, getUpdates: vi.fn() };
    const redisService = { acquireLock: vi.fn(), releaseLock: vi.fn() };
    const poller = new TelegramPoller(
      telegramService as unknown as TelegramService,
      {} as InboundQueueProducer,
      redisService as unknown as RedisService,
    );

    poller.onApplicationBootstrap();
    await poller.onModuleDestroy();

    expect(redisService.acquireLock).not.toHaveBeenCalled();
    expect(telegramService.getUpdates).not.toHaveBeenCalled();
  });
});
