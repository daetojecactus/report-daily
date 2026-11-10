import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Channel } from 'src/common/enums/channel.enums';
import { DeliveryKind, DeliveryStatus } from 'src/modules/application/delivery/delivery.enums';
import { deliveries } from 'src/modules/application/delivery/delivery.schema';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { ReportStatus } from 'src/modules/application/report/report.enums';
import { reports } from 'src/modules/application/report/report.schema';
import { userChannels } from 'src/modules/application/user/channel/channel.schema';
import { Gender, JobRole, UserStatus } from 'src/modules/application/user/user.enums';
import { users } from 'src/modules/application/user/user.schema';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { fakeBotApi } from 'test/setup/fake-bot-api';
import { createTestApp } from 'test/setup/test-app';
import { DeliveryTelegramQueueProducer } from '../delivery-telegram-queue.producer';

const DELIVERIES = 200;
const RATE_LIMITED = 3;
const BLOCKED = 10;
const RESTART_AFTER = 60;
const LIMIT_PER_SECOND = 25;
const WAIT_MS = 60_000;
const FIRST_CHAT = 7_200_000;

describe('Telegram delivery under load', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;
  const chats = Array.from({ length: DELIVERIES }, (_, index) => String(FIRST_CHAT + index));

  beforeAll(async () => {
    await fakeBotApi.reset();
    app = await createTestApp();
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
  });

  afterAll(async () => {
    await app.close();
  });

  async function queueDeliveries() {
    const created = await db
      .insert(users)
      .values(
        chats.map((chat) => ({
          displayName: `Load ${chat}`,
          role: JobRole.DEVELOPER,
          gender: Gender.MALE,
          status: UserStatus.ACTIVE,
          language: Language.EN,
        })),
      )
      .returning();
    await db.insert(userChannels).values(
      created.map((user, index) => ({
        userId: user.id,
        channel: Channel.TELEGRAM,
        externalId: chats[index],
      })),
    );
    const stored = await db
      .insert(reports)
      .values(
        created.map((user) => ({
          userId: user.id,
          reportDate: '2026-11-09',
          status: ReportStatus.READY,
          content: `project:\n• Fixed a bug for ${user.displayName}`,
        })),
      )
      .returning();
    const queued = await db
      .insert(deliveries)
      .values(
        stored.map((report) => ({
          userId: report.userId,
          channel: Channel.TELEGRAM,
          kind: DeliveryKind.REPORT,
          reportId: report.id,
        })),
      )
      .returning();
    const producer = app.get(DeliveryTelegramQueueProducer);
    for (const delivery of queued) {
      await producer.addDelivery(delivery.id);
    }
    return queued.map(({ id }) => id);
  }

  async function waitUntil(ids: string[], isDone: (statuses: DeliveryStatus[]) => boolean) {
    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      const rows = await db.select().from(deliveries).where(inArray(deliveries.id, ids));
      if (isDone(rows.map(({ status }) => status))) {
        return rows;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('Deliveries did not finish in time');
  }

  it(
    'sends each message once through 429, 403 and a restart within the rate limit',
    { timeout: 120_000 },
    async () => {
      for (let index = 0; index < RATE_LIMITED; index++) {
        await fakeBotApi.fail({
          method: 'sendMessage',
          code: 429,
          description: 'Too Many Requests: retry after 1',
          retryAfter: 1,
        });
      }
      for (let index = 0; index < BLOCKED; index++) {
        await fakeBotApi.fail({
          method: 'sendMessage',
          code: 403,
          description: 'Forbidden: bot was blocked by the user',
        });
      }

      const ids = await queueDeliveries();
      await waitUntil(
        ids,
        (statuses) =>
          statuses.filter((status) => status !== DeliveryStatus.QUEUED).length >= RESTART_AFTER,
      );
      await app.close();
      app = await createTestApp();
      db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
      const rows = await waitUntil(ids, (statuses) =>
        statuses.every((status) => status !== DeliveryStatus.QUEUED),
      );

      const failed = rows.filter(({ status }) => status === DeliveryStatus.FAILED);
      expect(failed).toHaveLength(BLOCKED);
      expect(rows.filter(({ status }) => status === DeliveryStatus.SENT)).toHaveLength(
        DELIVERIES - BLOCKED,
      );

      const sent = (await fakeBotApi.requests('sendMessage')).filter((request) =>
        chats.includes(String(request.body.chat_id)),
      );
      const perChat = new Map<string, number>();
      for (const request of sent) {
        const chat = String(request.body.chat_id);
        perChat.set(chat, (perChat.get(chat) ?? 0) + 1);
      }
      expect([...perChat.values()].every((count) => count === 1)).toBe(true);
      expect(perChat.size).toBe(DELIVERIES - BLOCKED);

      const unreachable = await db
        .select()
        .from(userChannels)
        .where(inArray(userChannels.externalId, chats));
      expect(unreachable.filter(({ reachable }) => !reachable)).toHaveLength(BLOCKED);

      const times = sent.map(({ at }) => at).sort((left, right) => left - right);
      const seconds = (times[times.length - 1] - times[0]) / 1000;
      expect((sent.length - LIMIT_PER_SECOND) / seconds).toBeLessThanOrEqual(LIMIT_PER_SECOND);
    },
  );
});
