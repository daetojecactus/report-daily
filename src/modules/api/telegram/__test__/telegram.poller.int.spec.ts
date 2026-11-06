import { Logger } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, inject, it, onTestFinished, vi } from 'vitest';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import type { TelegramChat, TelegramUser } from 'src/modules/vendors/telegram/telegram.interface';
import { fakeBotApi, privateMessage, type FakeUpdate } from 'test/setup/fake-bot-api';
import { createTestApp } from 'test/setup/test-app';
import {
  TELEGRAM_POLLER_LOCK_KEY,
  TELEGRAM_POLLER_LOCK_TTL_MS,
  TELEGRAM_POLLER_OFFSET_KEY,
} from '../constants/telegram-poller.constants';

const START_COMMAND = '/start';

let nextTelegramId = 500_000_000;

function startCommand(from: TelegramUser, chat: TelegramChat): FakeUpdate {
  return {
    message: {
      message_id: from.id,
      from,
      chat,
      text: START_COMMAND,
      entities: [{ type: 'bot_command', offset: 0, length: START_COMMAND.length }],
    },
  };
}

function replyTo(chatId: number) {
  return fakeBotApi.waitForRequest('sendMessage', (body) => body.chat_id === String(chatId));
}

describe('TelegramPoller', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  describe('polling', () => {
    let app: NestFastifyApplication;
    let redisService: RedisService;

    beforeAll(async () => {
      await fakeBotApi.reset();
      app = await createTestApp();
      redisService = app.get(RedisService);
    });

    afterAll(async () => {
      await app.close();
    });

    async function waitForOffset(offset: number) {
      await vi.waitFor(
        async () => {
          expect(await redisService.get(TELEGRAM_POLLER_OFFSET_KEY)).toBe(String(offset));
        },
        { timeout: 10_000 },
      );
    }

    async function expectSkipped(update: FakeUpdate, chatId: number) {
      const updateId = await fakeBotApi.pushUpdate(update);
      await waitForOffset(updateId + 1);

      const strangerId = nextTelegramId++;
      await fakeBotApi.pushUpdate(privateMessage(strangerId, 'hello'));
      await replyTo(strangerId);

      const sent = await fakeBotApi.requests('sendMessage');
      expect(sent.map(({ body }) => body.chat_id)).not.toContain(String(chatId));
    }

    it('stores the next offset after handling an update', async () => {
      const strangerId = nextTelegramId++;

      const updateId = await fakeBotApi.pushUpdate(privateMessage(strangerId, 'hello'));

      await replyTo(strangerId);
      await waitForOffset(updateId + 1);
    });

    it('skips a group chat message but moves the offset past it', async () => {
      const userId = nextTelegramId++;

      await expectSkipped(
        startCommand(
          { id: userId, is_bot: false, first_name: 'Test' },
          { id: -userId, type: 'group' },
        ),
        -userId,
      );
    });

    it('skips a message from a bot but moves the offset past it', async () => {
      const botId = nextTelegramId++;

      await expectSkipped(
        startCommand(
          { id: botId, is_bot: true, first_name: 'Bot' },
          { id: botId, type: 'private' },
        ),
        botId,
      );
    });

    it(
      'removes the webhook after a polling conflict and resumes polling',
      { timeout: 30_000 },
      async () => {
        await fakeBotApi.reset();
        await fakeBotApi.fail({
          method: 'getUpdates',
          code: 409,
          description: "Conflict: can't use getUpdates method while webhook is active",
        });
        await fakeBotApi.pushUpdate(privateMessage(nextTelegramId++, 'hello'));

        await vi.waitFor(
          async () => {
            expect(await fakeBotApi.requests('deleteWebhook')).toHaveLength(1);
          },
          { timeout: 15_000, interval: 100 },
        );

        const strangerId = nextTelegramId++;
        await fakeBotApi.pushUpdate(privateMessage(strangerId, 'hello'));
        await replyTo(strangerId);
        expect(await fakeBotApi.requests('deleteWebhook')).toHaveLength(1);
      },
    );
  });

  describe('lock', () => {
    it('holds the lock while running and releases it on close', async () => {
      const redis = new Redis(inject('redisUrl'));
      onTestFinished(async () => {
        await redis.quit();
      });

      const app = await createTestApp();
      try {
        await vi.waitFor(
          async () => {
            expect(await redis.exists(TELEGRAM_POLLER_LOCK_KEY)).toBe(1);
          },
          { timeout: 10_000 },
        );
        const ttl = await redis.pttl(TELEGRAM_POLLER_LOCK_KEY);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(TELEGRAM_POLLER_LOCK_TTL_MS);
      } finally {
        await app.close();
      }

      expect(await redis.exists(TELEGRAM_POLLER_LOCK_KEY)).toBe(0);
    });
  });
});
