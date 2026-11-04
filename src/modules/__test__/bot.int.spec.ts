import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/enums/channel.enums';
import {
  Gender,
  JobRole,
  Permission,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { en } from 'src/modules/application/i18n/locales/en.locale';
import { ru } from 'src/modules/application/i18n/locales/ru.locale';
import { userChannels } from 'src/modules/application/user/channel/channel.schema';
import type { UserInsert } from 'src/modules/application/user/user.interface';
import { users } from 'src/modules/application/user/user.schema';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { TEST_OWNER_TELEGRAM_ID } from 'test/setup/env';
import {
  buttonPress,
  fakeBotApi,
  privateMessage,
} from 'test/setup/fake-bot-api';
import { createTestApp } from 'test/setup/test-app';

let nextTelegramId = 200_000_000;

describe('Telegram bot', () => {
  let app: NestFastifyApplication;
  let db: NodePgDatabase;

  beforeAll(async () => {
    await fakeBotApi.reset();
    app = await createTestApp();
    db = app.get<NodePgDatabase>(DATABASE_INSTANCE);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createEmployee(
    values: Partial<UserInsert> = {},
    reachable = true,
  ) {
    const telegramId = nextTelegramId++;
    const [user] = await db
      .insert(users)
      .values({
        gitlabUserId: telegramId,
        gitlabUsername: `user${telegramId}`,
        displayName: 'Ivan_Petrov',
        role: JobRole.DEVELOPER,
        gender: Gender.MALE,
        status: UserStatus.ACTIVE,
        language: Language.EN,
        ...values,
      })
      .returning();
    await db.insert(userChannels).values({
      userId: user.id,
      channel: Channel.TELEGRAM,
      externalId: String(telegramId),
      reachable,
    });
    return { user, telegramId };
  }

  function replyTo(telegramId: number) {
    return fakeBotApi.waitForRequest(
      'sendMessage',
      (body) => body.chat_id === String(telegramId),
    );
  }

  it('sets the default command menus on start', async () => {
    const isDefault = (body: Record<string, unknown>) =>
      (body.scope as { type: string }).type === 'all_private_chats';
    const russian = await fakeBotApi.waitForRequest(
      'setMyCommands',
      (body) => isDefault(body) && body.language_code === Language.RU,
    );
    const fallback = await fakeBotApi.waitForRequest(
      'setMyCommands',
      (body) => isDefault(body) && body.language_code === undefined,
    );

    expect(russian).toMatchObject({
      scope: { type: 'all_private_chats' },
      commands: [
        { command: 'start', description: ru.commands.start },
        { command: 'help', description: ru.commands.help },
        { command: 'cancel', description: ru.commands.cancel },
      ],
    });
    expect(fallback).toMatchObject({
      scope: { type: 'all_private_chats' },
      commands: [
        { command: 'start', description: en.commands.start },
        { command: 'help', description: en.commands.help },
        { command: 'cancel', description: en.commands.cancel },
      ],
    });
  });

  it('tells a stranger their id in their language', async () => {
    const strangerId = nextTelegramId++;

    await fakeBotApi.pushUpdate(privateMessage(strangerId, '/start', 'ru'));

    const reply = await replyTo(strangerId);
    expect(reply.parse_mode).toBe('HTML');
    expect(reply.text).toContain('Нет доступа');
    expect(reply.text).toContain(`<code>${strangerId}</code>`);
  });

  it('answers any message from a stranger with their id', async () => {
    const strangerId = nextTelegramId++;

    await fakeBotApi.pushUpdate(privateMessage(strangerId, 'hello'));

    expect((await replyTo(strangerId)).text).toContain(
      `<code>${strangerId}</code>`,
    );
  });

  it('greets an owner and sets the owner menu', async () => {
    await fakeBotApi.pushUpdate(
      privateMessage(TEST_OWNER_TELEGRAM_ID, '/start'),
    );

    expect((await replyTo(TEST_OWNER_TELEGRAM_ID)).text).toBe(en.start.owner);
    expect(
      await fakeBotApi.waitForRequest(
        'setMyCommands',
        (body) =>
          (body.scope as { chat_id?: string }).chat_id ===
          String(TEST_OWNER_TELEGRAM_ID),
      ),
    ).toMatchObject({ scope: { type: 'chat' } });
  });

  it('greets an employee, records the language and marks the chat reachable', async () => {
    const { user, telegramId } = await createEmployee(
      { language: null },
      false,
    );

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/start', 'ru'));

    expect((await replyTo(telegramId)).text).toBe(
      ru.start.employee('Ivan_Petrov'),
    );
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    const [channel] = await db
      .select()
      .from(userChannels)
      .where(eq(userChannels.userId, user.id));
    expect(stored.language).toBe(Language.RU);
    expect(channel.reachable).toBe(true);
  });

  it('lists the commands of an employee in help', async () => {
    const { telegramId } = await createEmployee();

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/help'));

    const { text } = await replyTo(telegramId);
    expect(text).toContain(`/start — ${en.commands.start}`);
    expect(text).toContain(`/cancel — ${en.commands.cancel}`);
    expect(text).toContain(en.help.privacy);
  });

  it('ends a dialog on cancel', async () => {
    const { telegramId } = await createEmployee();
    const key = `dialog:telegram:${telegramId}`;
    await app
      .get(RedisService)
      .set(key, JSON.stringify({ namespace: 'test', step: 'name', data: {} }));

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/cancel'));

    expect((await replyTo(telegramId)).text).toBe(en.cancel.done);
    expect(await app.get(RedisService).get(key)).toBeNull();
  });

  it('treats a blocked employee as a stranger', async () => {
    const { telegramId } = await createEmployee({
      status: UserStatus.BLOCKED,
    });

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/start'));

    expect((await replyTo(telegramId)).text).toContain(
      `<code>${telegramId}</code>`,
    );
  });

  it('answers an unknown command', async () => {
    const { telegramId } = await createEmployee();

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/unknown'));

    expect((await replyTo(telegramId)).text).toBe(en.bot.unknownCommand);
  });

  it('answers an outdated button and edits its message', async () => {
    const { telegramId } = await createEmployee();

    await fakeBotApi.pushUpdate(buttonPress(telegramId, 'gone:open', 42));

    await fakeBotApi.waitForRequest('answerCallbackQuery');
    expect(
      await fakeBotApi.waitForRequest(
        'editMessageText',
        (body) => body.chat_id === String(telegramId),
      ),
    ).toMatchObject({ message_id: 42, text: en.bot.expired });
  });

  it('marks the chat unreachable when the employee blocked the bot', async () => {
    const { user, telegramId } = await createEmployee();
    await fakeBotApi.fail({
      method: 'sendMessage',
      code: 403,
      description: 'Forbidden: bot was blocked by the user',
    });

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/help'));

    await vi.waitFor(
      async () => {
        const [channel] = await db
          .select()
          .from(userChannels)
          .where(eq(userChannels.userId, user.id));
        expect(channel.reachable).toBe(false);
      },
      { timeout: 10_000 },
    );
  });

  it('shows employees to an owner through /admin', async () => {
    const tag = `Zinaida${nextTelegramId}`;
    const { user } = await createEmployee({ displayName: `${tag} Admin` });
    const ownerChat = String(TEST_OWNER_TELEGRAM_ID);

    await fakeBotApi.pushUpdate(
      privateMessage(TEST_OWNER_TELEGRAM_ID, '/admin'),
    );
    expect(
      await fakeBotApi.waitForRequest(
        'sendMessage',
        (body) =>
          body.chat_id === ownerChat && body.text === '<b>Management</b>',
      ),
    ).toMatchObject({
      reply_markup: {
        inline_keyboard: [[{ text: 'Employees', callback_data: 'emp:list:0' }]],
      },
    });

    await fakeBotApi.pushUpdate(
      buttonPress(TEST_OWNER_TELEGRAM_ID, 'emp:list:0', 501),
    );
    const list = await fakeBotApi.waitForRequest(
      'editMessageText',
      (body) => body.message_id === 501,
    );
    expect(list.text).toMatch(/^<b>Employees<\/b> · \d+/);

    await fakeBotApi.pushUpdate(
      buttonPress(TEST_OWNER_TELEGRAM_ID, 'emp:search', 502),
    );
    expect(
      await fakeBotApi.waitForRequest(
        'editMessageText',
        (body) => body.message_id === 502,
      ),
    ).toMatchObject({ text: en.employees.searchPrompt });

    await fakeBotApi.pushUpdate(
      privateMessage(TEST_OWNER_TELEGRAM_ID, tag.toLowerCase()),
    );
    const results = await fakeBotApi.waitForRequest(
      'sendMessage',
      (body) =>
        body.chat_id === ownerChat &&
        String(body.text).includes(tag.toLowerCase()),
    );
    expect(results.reply_markup).toMatchObject({
      inline_keyboard: [
        [
          {
            text: `${tag} Admin · Developer`,
            callback_data: `emp:card:${user.id}:0`,
          },
        ],
        expect.anything(),
      ],
    });

    await fakeBotApi.pushUpdate(
      buttonPress(TEST_OWNER_TELEGRAM_ID, `emp:card:${user.id}:0`, 503),
    );
    const card = await fakeBotApi.waitForRequest(
      'editMessageText',
      (body) => body.message_id === 503,
    );
    expect(card.text).toContain(`<b>${tag} Admin</b>`);
    expect(card.text).toContain('Role: Developer');
    expect(card.text).toContain('Telegram: connected');
  });

  it('forbids /admin to an employee without permissions', async () => {
    const { telegramId } = await createEmployee();

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/admin'));

    expect((await replyTo(telegramId)).text).toBe(en.bot.forbidden);
  });

  it('opens /admin for an admin with the users permission', async () => {
    const { telegramId } = await createEmployee({
      permissions: [Permission.USERS],
    });

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/admin'));

    expect(await replyTo(telegramId)).toMatchObject({
      text: '<b>Management</b>',
      reply_markup: {
        inline_keyboard: [[{ text: 'Employees', callback_data: 'emp:list:0' }]],
      },
    });
  });
});
