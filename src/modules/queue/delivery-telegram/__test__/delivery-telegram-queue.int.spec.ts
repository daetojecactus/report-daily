import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { DeliveryStatus } from 'src/modules/application/delivery/types/delivery.enums';
import { deliveries } from 'src/modules/application/delivery/delivery.schema';
import { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { ReportStatus } from 'src/modules/application/report/types/report.enums';
import { reports } from 'src/modules/application/report/report.schema';
import { userChannels } from 'src/modules/application/user/channel/channel.schema';
import { Gender, JobRole, UserStatus } from 'src/modules/application/user/types/user.enums';
import { users } from 'src/modules/application/user/user.schema';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { fakeBotApi } from 'test/setup/fake-bot-api';
import { createTestApp } from 'test/setup/test-app';
import { DeliveryTelegramQueueProducer } from '../delivery-telegram-queue.producer';

const WAIT_MS = 15_000;

describe('Telegram delivery queue', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;
  let nextTelegramId = 7_100_000;

  beforeAll(async () => {
    await fakeBotApi.reset();
    app = await createTestApp();
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
  });

  afterAll(async () => {
    await app.close();
  });

  async function queueReport(content: string) {
    const telegramId = String(nextTelegramId++);
    const [user] = await db
      .insert(users)
      .values({
        displayName: 'Dev Me',
        role: JobRole.DEVELOPER,
        gender: Gender.MALE,
        status: UserStatus.ACTIVE,
        language: Language.EN,
      })
      .returning();
    await db
      .insert(userChannels)
      .values({ userId: user.id, channel: Channel.TELEGRAM, externalId: telegramId });
    const [report] = await db
      .insert(reports)
      .values({ userId: user.id, reportDate: '2026-11-09', status: ReportStatus.READY, content })
      .returning();
    const delivery = await app
      .get(DeliveryService)
      .createForReport(report, Channel.TELEGRAM, false);
    await app.get(DeliveryTelegramQueueProducer).addDelivery(delivery.id);
    return { telegramId, report, delivery };
  }

  async function waitForDelivery(id: string, status: DeliveryStatus) {
    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, id));
      if (delivery.status === status) {
        return delivery;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Delivery ${id} did not become ${status}`);
  }

  it('sends a report and marks the delivery and the report', async () => {
    const { telegramId, report, delivery } = await queueReport('project:\n• Fixed a bug');

    const message = await fakeBotApi.waitForRequest(
      'sendMessage',
      (body) => body.chat_id === telegramId,
    );
    expect(message.text).toBe('project:\n• Fixed a bug');
    expect(await waitForDelivery(delivery.id, DeliveryStatus.SENT)).toMatchObject({
      attempts: 1,
      error: null,
    });
    const [stored] = await db.select().from(reports).where(eq(reports.id, report.id));
    expect(stored.status).toBe(ReportStatus.DELIVERED);
  });

  it('waits out a 429 and then sends', async () => {
    await fakeBotApi.fail({
      method: 'sendMessage',
      code: 429,
      description: 'Too Many Requests: retry after 1',
      retryAfter: 1,
    });

    const { delivery } = await queueReport('project:\n• Left a comment');

    expect(await waitForDelivery(delivery.id, DeliveryStatus.SENT)).toMatchObject({ attempts: 2 });
  });

  it('fails a delivery to a chat that blocked the bot and marks the chat', async () => {
    await fakeBotApi.fail({
      method: 'sendMessage',
      code: 403,
      description: 'Forbidden: bot was blocked by the user',
    });

    const { telegramId, delivery } = await queueReport('project:\n• Reviewed a change');

    expect(await waitForDelivery(delivery.id, DeliveryStatus.FAILED)).toMatchObject({
      attempts: 1,
      error: expect.stringContaining('blocked') as string,
    });
    const [chat] = await db
      .select()
      .from(userChannels)
      .where(eq(userChannels.externalId, telegramId));
    expect(chat.reachable).toBe(false);
  });
});
