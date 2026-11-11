import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { DeliveryStatus } from 'src/modules/application/delivery/types/delivery.enums';
import { deliveries } from 'src/modules/application/delivery/delivery.schema';
import { DeliveryService } from 'src/modules/application/delivery/delivery.service';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { ReportStatus } from 'src/modules/application/report/types/report.enums';
import { reports } from 'src/modules/application/report/report.schema';
import { userChannels } from 'src/modules/application/user/channel/channel.schema';
import { Gender, JobRole, UserStatus } from 'src/modules/application/user/types/user.enums';
import { users } from 'src/modules/application/user/user.schema';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { DeliveryQueueProducer } from 'src/modules/queue/delivery/delivery-queue.producer';
import { SlackFormatter } from 'src/modules/vendors/slack/slack.formatter';
import { SlackRenderer } from 'src/modules/vendors/slack/slack.renderer';
import { SlackSocket } from 'src/modules/vendors/slack/slack.socket';
import { fakeSlackApi } from 'test/setup/fake-slack-api';
import { createTestApp } from 'test/setup/test-app';
import { SlackListener } from '../slack.listener';

const SLACK_ENV = {
  SLACK_BOT_TOKEN: 'xoxb-integration',
  SLACK_APP_TOKEN: 'xapp-integration',
  OWNER_SLACK_IDS: 'U0OWNER01',
};
const WAIT_MS = 15_000;
const ru = new I18nService().getLocale(Language.RU);
const renderer = new SlackRenderer(new SlackFormatter());

describe('Slack', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;
  let nextEvent = 1;
  let nextMember = 1;

  beforeAll(async () => {
    Object.assign(process.env, SLACK_ENV);
    app = await createTestApp([], (builder) =>
      builder.overrideProvider(SlackSocket).useValue({
        isEnabled: () => false,
        listen: () => Promise.resolve(),
        close: () => Promise.resolve(),
      }),
    );
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
  });

  afterAll(async () => {
    await app.close();
    for (const key of Object.keys(SLACK_ENV)) {
      delete process.env[key];
    }
  });

  beforeEach(async () => {
    await fakeSlackApi.reset();
  });

  function nextMemberId() {
    return `U0MEMBER${nextMember++}`;
  }

  async function addEmployee(memberId: string) {
    const [user] = await db
      .insert(users)
      .values({
        displayName: 'Dev Me',
        role: JobRole.DEVELOPER,
        gender: Gender.MALE,
        status: UserStatus.ACTIVE,
        language: Language.RU,
      })
      .returning();
    await db
      .insert(userChannels)
      .values({ userId: user.id, channel: Channel.SLACK, externalId: memberId });
    return user;
  }

  function message(memberId: string, text: string) {
    const id = nextEvent++;
    return app.get(SlackListener).receive({
      type: 'events_api',
      body: {
        event_id: `Ev${id}`,
        event: {
          type: 'message',
          channel_type: 'im',
          channel: `D${memberId}`,
          user: memberId,
          text,
        },
      },
      envelopeId: `envelope-${id}`,
      ack: () => Promise.resolve(),
    });
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

  it('answers an employee in the direct messages in Block Kit and in the employee language', async () => {
    const memberId = nextMemberId();
    await addEmployee(memberId);

    await message(memberId, 'help');

    const reply = await fakeSlackApi.waitForRequest(
      'chat.postMessage',
      (body) => body.channel === `D${memberId}`,
    );
    expect(String(reply.text)).toContain('*Команды*');
    expect(reply.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'section' })]),
    );
    expect(reply.unfurl_links).toBe('false');
  });

  it('answers a stranger in the language of the Slack profile', async () => {
    const memberId = nextMemberId();
    await fakeSlackApi.setLocale(memberId, 'ru-RU');

    await message(memberId, 'hi');

    const reply = await fakeSlackApi.waitForRequest(
      'chat.postMessage',
      (body) => body.channel === `D${memberId}`,
    );
    expect(reply.text).toBe(
      renderer.render({ text: ru.bot.noAccess(ru.channels.slack, memberId) }).text,
    );
    expect(await fakeSlackApi.requests()).toContainEqual({
      method: 'users.info',
      body: expect.objectContaining({ user: memberId, include_locale: 'true' }) as object,
    });
  });

  it('delivers a report to the Slack of the employee and marks the delivery sent', async () => {
    const memberId = nextMemberId();
    const user = await addEmployee(memberId);
    const [report] = await db
      .insert(reports)
      .values({
        userId: user.id,
        reportDate: '2026-11-10',
        status: ReportStatus.READY,
        content: 'project:\n• Fixed a bug',
      })
      .returning();
    const delivery = await app.get(DeliveryService).createForReport(report, Channel.SLACK, false);

    await app.get(DeliveryQueueProducer).addDelivery(Channel.SLACK, delivery.id);

    const sent = await fakeSlackApi.waitForRequest(
      'chat.postMessage',
      (body) => body.channel === memberId,
    );
    expect(String(sent.text)).toContain('Fixed a bug');
    expect(await waitForDelivery(delivery.id, DeliveryStatus.SENT)).toMatchObject({
      externalMessageId: expect.stringMatching(/^1731240000\./) as string,
    });
  });

  it('fails a delivery to a member Slack cannot reach and marks the channel', async () => {
    const memberId = nextMemberId();
    const user = await addEmployee(memberId);
    const [report] = await db
      .insert(reports)
      .values({
        userId: user.id,
        reportDate: '2026-11-10',
        status: ReportStatus.READY,
        content: 'project:\n• Reviewed a change',
      })
      .returning();
    const delivery = await app.get(DeliveryService).createForReport(report, Channel.SLACK, false);
    await fakeSlackApi.fail({ method: 'chat.postMessage', error: 'user_not_found' });

    await app.get(DeliveryQueueProducer).addDelivery(Channel.SLACK, delivery.id);

    expect(await waitForDelivery(delivery.id, DeliveryStatus.FAILED)).toMatchObject({
      error: 'user_not_found',
    });
    const [channel] = await db
      .select()
      .from(userChannels)
      .where(eq(userChannels.externalId, memberId));
    expect(channel.reachable).toBe(false);
  });
});
