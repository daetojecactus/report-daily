import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/enums/channel.enums';
import { Gender, JobRole, Permission, UserStatus } from 'src/modules/application/user/user.enums';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { en } from 'src/modules/application/i18n/locales/en.locale';
import { ru } from 'src/modules/application/i18n/locales/ru.locale';
import { userChannels } from 'src/modules/application/user/channel/channel.schema';
import type { UserInsert } from 'src/modules/application/user/user.interface';
import { users } from 'src/modules/application/user/user.schema';
import { userSources } from 'src/modules/application/user/user-source/user-source.schema';
import { Source } from 'src/modules/application/source/source.enums';
import { traitMappings } from 'src/modules/application/trait/trait.schema';
import { ReportStatus } from 'src/modules/application/report/report.enums';
import { reports } from 'src/modules/application/report/report.schema';
import { settings } from 'src/modules/application/settings/settings.schema';
import { TraitDimension, Priority } from 'src/modules/application/trait/trait.enums';
import { DATABASE_INSTANCE } from 'src/modules/infrastructure/database/constants/database.constants';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { TEST_OWNER_TELEGRAM_ID } from 'test/setup/env';
import { buttonPress, fakeBotApi, pickedUser, privateMessage } from 'test/setup/fake-bot-api';
import { fakeGitLab } from 'test/setup/fake-gitlab';
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

  async function createEmployee(values: Partial<UserInsert> = {}, reachable = true) {
    const telegramId = nextTelegramId++;
    const [user] = await db
      .insert(users)
      .values({
        displayName: 'Ivan_Petrov',
        role: JobRole.DEVELOPER,
        gender: Gender.MALE,
        status: UserStatus.ACTIVE,
        language: Language.EN,
        ...values,
      })
      .returning();
    await db.insert(userSources).values({
      userId: user.id,
      source: Source.GITLAB,
      externalId: String(telegramId),
      username: `user${telegramId}`,
    });
    await db.insert(userChannels).values({
      userId: user.id,
      channel: Channel.TELEGRAM,
      externalId: String(telegramId),
      reachable,
    });
    return { user, telegramId };
  }

  function replyTo(telegramId: number) {
    return fakeBotApi.waitForRequest('sendMessage', (body) => body.chat_id === String(telegramId));
  }

  async function press(telegramId: number, data: string, messageId: number) {
    await fakeBotApi.pushUpdate(buttonPress(telegramId, data, messageId));
    return fakeBotApi.waitForRequest('editMessageText', (body) => body.message_id === messageId);
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

    expect((await replyTo(strangerId)).text).toContain(`<code>${strangerId}</code>`);
  });

  it('greets an owner and sets the owner menu', async () => {
    await fakeBotApi.pushUpdate(privateMessage(TEST_OWNER_TELEGRAM_ID, '/start'));

    expect((await replyTo(TEST_OWNER_TELEGRAM_ID)).text).toBe(en.start.owner);
    expect(
      await fakeBotApi.waitForRequest(
        'setMyCommands',
        (body) => (body.scope as { chat_id?: string }).chat_id === String(TEST_OWNER_TELEGRAM_ID),
      ),
    ).toMatchObject({ scope: { type: 'chat' } });
  });

  it('greets an employee, records the language and marks the chat reachable', async () => {
    const { user, telegramId } = await createEmployee({ language: null }, false);

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/start', 'ru'));

    expect((await replyTo(telegramId)).text).toBe(ru.start.employee('Ivan_Petrov'));
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    const [channel] = await db.select().from(userChannels).where(eq(userChannels.userId, user.id));
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

  it('offers the days on /report and builds the chosen one', async () => {
    const { user, telegramId } = await createEmployee();
    await fakeGitLab.addUser({
      id: telegramId,
      username: `user${telegramId}`,
      name: `User ${telegramId}`,
      state: 'active',
      avatar_url: 'https://gitlab.example.com/avatar.png',
      web_url: `https://gitlab.example.com/user${telegramId}`,
      hasActivity: false,
    });

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/report'));

    expect((await replyTo(telegramId)).text).toBe(en.report.choose);
    expect((await press(telegramId, 'rpt:day:0', 1901)).text).toBe(en.report.building('today'));
    await fakeBotApi.waitForRequest(
      'sendMessage',
      (body) => body.chat_id === String(telegramId) && body.text === en.report.empty('today'),
    );
    const [report] = await db.select().from(reports).where(eq(reports.userId, user.id));
    expect(report).toMatchObject({ status: ReportStatus.EMPTY, content: '' });
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

    expect((await replyTo(telegramId)).text).toContain(`<code>${telegramId}</code>`);
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

    await fakeBotApi.pushUpdate(privateMessage(TEST_OWNER_TELEGRAM_ID, '/admin'));
    expect(
      await fakeBotApi.waitForRequest(
        'sendMessage',
        (body) => body.chat_id === ownerChat && body.text === '<b>Management</b>',
      ),
    ).toMatchObject({
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Employees', callback_data: 'emp:list:0' }],
          [{ text: 'Traits', callback_data: 'trt:list:0' }],
          [{ text: 'Templates', callback_data: 'tpls:list' }],
          [{ text: 'Settings', callback_data: 'aset:menu' }],
        ],
      },
    });

    await fakeBotApi.pushUpdate(buttonPress(TEST_OWNER_TELEGRAM_ID, 'emp:list:0', 501));
    const list = await fakeBotApi.waitForRequest(
      'editMessageText',
      (body) => body.message_id === 501,
    );
    expect(list.text).toMatch(/^<b>Employees<\/b> · \d+/);

    await fakeBotApi.pushUpdate(buttonPress(TEST_OWNER_TELEGRAM_ID, 'emp:search', 502));
    expect(
      await fakeBotApi.waitForRequest('editMessageText', (body) => body.message_id === 502),
    ).toMatchObject({ text: en.employees.searchPrompt });

    await fakeBotApi.pushUpdate(privateMessage(TEST_OWNER_TELEGRAM_ID, tag.toLowerCase()));
    const results = await fakeBotApi.waitForRequest(
      'sendMessage',
      (body) => body.chat_id === ownerChat && String(body.text).includes(tag.toLowerCase()),
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

    await fakeBotApi.pushUpdate(buttonPress(TEST_OWNER_TELEGRAM_ID, `emp:card:${user.id}:0`, 503));
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

  it('adds an employee from GitLab through /admin', async () => {
    const gitlabUserId = nextTelegramId++;
    const tag = `Petrova${gitlabUserId}`;
    const ownerChat = String(TEST_OWNER_TELEGRAM_ID);
    await fakeGitLab.addUser({
      id: gitlabUserId,
      username: tag.toLowerCase(),
      name: `Olga ${tag}`,
      state: 'active',
      avatar_url: 'https://gitlab.example.com/avatar.png',
      web_url: `https://gitlab.example.com/${tag.toLowerCase()}`,
      hasActivity: false,
    });
    const step = (messageId: number) =>
      fakeBotApi.waitForRequest('editMessageText', (body) => body.message_id === messageId);

    await fakeBotApi.pushUpdate(buttonPress(TEST_OWNER_TELEGRAM_ID, 'add:start', 601));
    expect((await step(601)).text).toBe(en.employeeAdd.prompt);

    await fakeBotApi.pushUpdate(privateMessage(TEST_OWNER_TELEGRAM_ID, tag));
    const matches = await fakeBotApi.waitForRequest(
      'sendMessage',
      (body) => body.chat_id === ownerChat && String(body.text).startsWith(`<b>GitLab:</b> ${tag}`),
    );
    expect(matches.reply_markup).toEqual({
      inline_keyboard: [
        [
          {
            text: `Olga ${tag} · @${tag.toLowerCase()}`,
            callback_data: `add:pick:${gitlabUserId}`,
          },
        ],
        [{ text: 'Cancel', callback_data: 'add:cancel' }],
      ],
    });

    await fakeBotApi.pushUpdate(
      buttonPress(TEST_OWNER_TELEGRAM_ID, `add:pick:${gitlabUserId}`, 602),
    );
    expect((await step(602)).text).toContain('Choose the role.');
    await fakeBotApi.pushUpdate(buttonPress(TEST_OWNER_TELEGRAM_ID, 'add:role:qa', 603));
    expect((await step(603)).text).toContain('Choose the gender.');
    await fakeBotApi.pushUpdate(buttonPress(TEST_OWNER_TELEGRAM_ID, 'add:gender:female', 604));

    const added = await step(604);
    expect(added.text).toContain(`Employee added: <b>Olga ${tag}</b>.`);
    expect(added.text).toContain(en.employeeAdd.activityHidden);
    const [{ user: stored, account }] = await db
      .select({ user: users, account: userSources })
      .from(userSources)
      .innerJoin(users, eq(users.id, userSources.userId))
      .where(eq(userSources.externalId, String(gitlabUserId)));
    expect(account).toMatchObject({
      source: Source.GITLAB,
      username: tag.toLowerCase(),
    });
    expect(stored).toMatchObject({
      displayName: `Olga ${tag}`,
      role: JobRole.QA,
      gender: Gender.FEMALE,
      status: UserStatus.PENDING,
      language: null,
    });
  });

  it('binds the Telegram of an added employee who then gets access', async () => {
    const { user } = await createEmployee({
      displayName: `Pending${nextTelegramId}`,
      status: UserStatus.PENDING,
      language: null,
    });
    await db.delete(userChannels).where(eq(userChannels.userId, user.id));
    const employeeId = nextTelegramId++;
    const ownerChat = String(TEST_OWNER_TELEGRAM_ID);

    await fakeBotApi.pushUpdate(buttonPress(TEST_OWNER_TELEGRAM_ID, `bind:start:${user.id}`, 701));
    expect(
      (await fakeBotApi.waitForRequest('editMessageText', (body) => body.message_id === 701)).text,
    ).toContain('Telegram ID');

    await fakeBotApi.pushUpdate(privateMessage(TEST_OWNER_TELEGRAM_ID, String(employeeId)));
    expect(
      await fakeBotApi.waitForRequest(
        'sendMessage',
        (body) => body.chat_id === ownerChat && String(body.text).startsWith('Telegram bound:'),
      ),
    ).toMatchObject({
      text: expect.stringContaining(`<b>Pending`) as unknown,
    });
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(stored.status).toBe(UserStatus.ACTIVE);

    await fakeBotApi.pushUpdate(privateMessage(employeeId, '/start', 'ru'));
    expect((await replyTo(employeeId)).text).toBe(ru.start.employee(user.displayName));
  });

  it('binds an employee picked in Telegram', async () => {
    const { user } = await createEmployee({
      displayName: `Picked${nextTelegramId}`,
      status: UserStatus.PENDING,
    });
    await db.delete(userChannels).where(eq(userChannels.userId, user.id));
    const pickedId = nextTelegramId++;
    const ownerChat = String(TEST_OWNER_TELEGRAM_ID);

    await fakeBotApi.pushUpdate(buttonPress(TEST_OWNER_TELEGRAM_ID, `bind:pick:${user.id}`, 801));
    expect(
      await fakeBotApi.waitForRequest(
        'sendMessage',
        (body) =>
          body.chat_id === ownerChat &&
          String(body.text).startsWith('Press &quot;Choose the employee&quot;'),
      ),
    ).toMatchObject({
      reply_markup: {
        keyboard: [
          [
            {
              text: en.employeeBind.pickButton,
              request_users: { request_id: 1, user_is_bot: false },
            },
          ],
        ],
        one_time_keyboard: true,
      },
    });

    await fakeBotApi.pushUpdate(pickedUser(TEST_OWNER_TELEGRAM_ID, pickedId));
    await fakeBotApi.waitForRequest(
      'sendMessage',
      (body) =>
        body.chat_id === ownerChat &&
        String(body.text).includes(`<b>${user.displayName}</b>`) &&
        String(body.text).startsWith('Telegram bound:'),
    );
    const [channel] = await db.select().from(userChannels).where(eq(userChannels.userId, user.id));
    expect(channel.externalId).toBe(String(pickedId));
  });

  it('sends a report to an employee from the card and tells the owner the outcome', async () => {
    const { user, telegramId } = await createEmployee({ displayName: `Reported${nextTelegramId}` });
    await fakeGitLab.addUser({
      id: telegramId,
      username: `user${telegramId}`,
      name: `User ${telegramId}`,
      state: 'active',
      avatar_url: 'https://gitlab.example.com/avatar.png',
      web_url: `https://gitlab.example.com/user${telegramId}`,
      hasActivity: false,
    });

    await fakeBotApi.pushUpdate(buttonPress(TEST_OWNER_TELEGRAM_ID, `mng:report:${user.id}`, 1951));

    expect(
      (await fakeBotApi.waitForRequest('editMessageText', (body) => body.message_id === 1951)).text,
    ).toContain(`Building today's report for <b>${user.displayName}</b>`);
    const outcome = await fakeBotApi.waitForRequest(
      'sendMessage',
      (body) =>
        body.chat_id === String(TEST_OWNER_TELEGRAM_ID) &&
        String(body.text).includes('has no actions in GitLab today'),
    );
    expect(outcome.text).toContain(user.displayName);
  });

  it('blocks, unblocks and deletes an employee from the card', async () => {
    const { user, telegramId } = await createEmployee({
      displayName: `Managed${nextTelegramId}`,
    });
    const press = async (data: string, messageId: number) => {
      await fakeBotApi.pushUpdate(buttonPress(TEST_OWNER_TELEGRAM_ID, data, messageId));
      return fakeBotApi.waitForRequest('editMessageText', (body) => body.message_id === messageId);
    };

    expect((await press(`mng:block:${user.id}`, 901)).text).toContain('Employee blocked');
    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/start'));
    expect((await replyTo(telegramId)).text).toContain(`<code>${telegramId}</code>`);

    expect((await press(`mng:unblock:${user.id}`, 902)).text).toContain('Employee unblocked');
    const [unblocked] = await db.select().from(users).where(eq(users.id, user.id));
    expect(unblocked.status).toBe(UserStatus.ACTIVE);

    expect((await press(`mng:delete:${user.id}`, 903)).text).toContain('Delete the employee');
    expect((await press(`mng:confirm:${user.id}`, 904)).text).toContain('Employee deleted');
    expect(await db.select().from(users).where(eq(users.id, user.id))).toEqual([]);
  });

  it('lets an owner grant and revoke permissions with the menu following', async () => {
    const { user, telegramId } = await createEmployee({
      displayName: `Rights${nextTelegramId}`,
    });
    const chatId = String(telegramId);

    await fakeBotApi.pushUpdate(
      buttonPress(TEST_OWNER_TELEGRAM_ID, `perm:grant:${user.id}:users`, 1001),
    );
    expect(
      (await fakeBotApi.waitForRequest('editMessageText', (body) => body.message_id === 1001)).text,
    ).toContain('Permissions in the bot');
    const menu = await fakeBotApi.waitForRequest(
      'setMyCommands',
      (body) => (body.scope as { chat_id?: string }).chat_id === chatId,
    );
    expect((menu.commands as { command: string }[]).map((item) => item.command)).toEqual([
      'start',
      'report',
      'settings',
      'admin',
      'help',
      'cancel',
    ]);

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/admin'));
    expect((await replyTo(telegramId)).text).toBe('<b>Management</b>');

    await fakeBotApi.pushUpdate(
      buttonPress(TEST_OWNER_TELEGRAM_ID, `perm:revoke:${user.id}:users`, 1002),
    );
    await fakeBotApi.waitForRequest('editMessageText', (body) => body.message_id === 1002);
    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/admin'));
    await fakeBotApi.waitForRequest(
      'sendMessage',
      (body) => body.chat_id === chatId && body.text === en.bot.forbidden,
    );
  });

  it('keeps permissions for owners only', async () => {
    const { telegramId } = await createEmployee({
      permissions: [Permission.USERS],
    });
    const { user } = await createEmployee();

    await fakeBotApi.pushUpdate(buttonPress(telegramId, `perm:open:${user.id}`, 1003));

    expect(
      await fakeBotApi.waitForRequest('editMessageText', (body) => body.message_id === 1003),
    ).toMatchObject({ text: en.bot.forbidden });
  });

  it('lets an employee change the language, report time and time zone', async () => {
    const { user, telegramId } = await createEmployee();
    const chatId = String(telegramId);

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/settings'));
    expect((await replyTo(telegramId)).text).toContain('<b>My settings</b>');

    expect((await press(telegramId, 'set:lang:ru', 1101)).text).toContain('<b>Мои настройки</b>');
    const menu = await fakeBotApi.waitForRequest(
      'setMyCommands',
      (body) => (body.scope as { chat_id?: string }).chat_id === chatId,
    );
    expect(menu.commands).toContainEqual({
      command: 'settings',
      description: ru.commands.settings,
    });

    expect((await press(telegramId, 'set:time:09:30', 1102)).text).toContain('Время отчёта: 09:30');
    await press(telegramId, 'set:tz', 1103);
    await fakeBotApi.pushUpdate(privateMessage(telegramId, 'europe/moscow'));
    await fakeBotApi.waitForRequest(
      'sendMessage',
      (body) => body.chat_id === chatId && String(body.text).includes('<code>Europe/Moscow</code>'),
    );

    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(stored).toMatchObject({
      language: Language.RU,
      reportTime: '09:30:00',
      timezone: 'Europe/Moscow',
    });
  });

  it('lets an employee switch the scheduled report, AI and data in AI and set the gender', async () => {
    const { user, telegramId } = await createEmployee();

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/settings'));
    expect((await replyTo(telegramId)).text).toContain('Gender: male');

    const switched = await press(telegramId, 'set:ai:off', 1201);
    expect(
      (switched.reply_markup as { inline_keyboard: unknown[][] }).inline_keyboard,
    ).toContainEqual([{ text: 'AI: no', callback_data: 'set:ai:on' }]);
    await press(telegramId, 'set:aidata:off', 1202);
    expect((await press(telegramId, 'set:gender:female', 1203)).text).toContain('Gender: female');
    await press(telegramId, 'set:sched:off', 1204);

    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(stored).toMatchObject({
      scheduleEnabled: false,
      aiEnabled: false,
      aiDataOptOut: true,
      gender: Gender.FEMALE,
    });
  });

  it('lets an admin with the labels permission map a label to our value', async () => {
    const { telegramId } = await createEmployee({
      permissions: [Permission.TRAITS],
    });
    const label = `status::easy ${telegramId}`;

    await fakeBotApi.pushUpdate(privateMessage(telegramId, '/admin'));
    expect(await replyTo(telegramId)).toMatchObject({
      reply_markup: {
        inline_keyboard: [[{ text: 'Traits', callback_data: 'trt:list:0' }]],
      },
    });
    expect((await press(telegramId, 'trt:list:0', 1401)).text).toMatch(
      /^<b>Traits<\/b> · GitLab labels: \d+/,
    );
    expect((await press(telegramId, 'trtadd:start', 1402)).text).toBe(
      'Send the label as in GitLab, for example <code>status::easy</code>. Letter case, extra spaces and <code>_</code> do not matter.',
    );
    await fakeBotApi.pushUpdate(privateMessage(telegramId, label));
    await fakeBotApi.waitForRequest(
      'sendMessage',
      (body) =>
        body.chat_id === String(telegramId) && String(body.text).endsWith('Who is the trait for?'),
    );
    await press(telegramId, 'trtadd:role:all', 1403);
    await press(telegramId, 'trtadd:dim:priority', 1404);
    expect((await press(telegramId, 'trtadd:val:low', 1405)).text).toBe(
      `Done: <b>${label}</b> for everyone — Priority: Low.`,
    );

    expect(
      await db.select().from(traitMappings).where(eq(traitMappings.sourceName, label)),
    ).toMatchObject([
      {
        sourceKey: label,
        role: null,
        dimension: TraitDimension.PRIORITY,
        value: Priority.LOW,
      },
    ]);
  });

  it('keeps labels closed without the labels permission', async () => {
    const { telegramId } = await createEmployee();

    expect((await press(telegramId, 'trt:list:0', 1406)).text).toBe(en.bot.forbidden);
  });

  it('lets an admin change a label value and delete the label', async () => {
    const { telegramId } = await createEmployee({
      permissions: [Permission.TRAITS],
    });
    const label = `stage::wip ${telegramId}`;
    const [mapping] = await db
      .insert(traitMappings)
      .values({
        source: Source.GITLAB,
        sourceName: label,
        sourceKey: label,
        role: null,
        dimension: TraitDimension.PRIORITY,
        value: Priority.LOW,
      })
      .returning();
    const findStored = () =>
      db.select().from(traitMappings).where(eq(traitMappings.sourceKey, label));

    expect((await press(telegramId, `trt:card:${mapping.id}:0`, 1501)).text).toBe(
      `<b>${label}</b>\n\nFor everyone:\n• Priority: Low`,
    );
    await press(telegramId, `trtmng:open:${mapping.id}`, 1502);
    expect((await press(telegramId, `trtmng:set:${mapping.id}:1`, 1503)).text).toBe(
      `Done: <b>${label}</b> for everyone — now Priority: High.`,
    );
    expect(await findStored()).toMatchObject([{ value: Priority.HIGH }]);

    await press(telegramId, `trtmng:drop:${mapping.id}`, 1504);
    expect((await press(telegramId, `trtmng:dropok:${mapping.id}`, 1505)).text).toBe(
      `The label <b>${label}</b> is deleted.`,
    );
    expect(await findStored()).toEqual([]);
  });

  it('lets an admin with the settings permission pause and resume scheduled reports', async () => {
    const { telegramId } = await createEmployee({ permissions: [Permission.SETTINGS] });

    expect((await press(telegramId, 'aset:menu', 2001)).text).toContain(en.adminSettings.reportsOn);
    expect((await press(telegramId, 'aset:forever', 2002)).text).toContain(
      en.adminSettings.pausedForever,
    );
    expect(await db.select().from(settings)).toMatchObject([
      { reportsPaused: true, reportsPausedUntil: null },
    ]);
    expect((await press(telegramId, 'aset:resume', 2003)).text).toContain(
      en.adminSettings.reportsOn,
    );
  });

  it('keeps the settings closed without the settings permission', async () => {
    const { telegramId } = await createEmployee();

    expect((await press(telegramId, 'aset:forever', 2004)).text).toBe(en.bot.forbidden);
    expect(await db.select().from(settings)).toMatchObject([{ reportsPaused: false }]);
  });
});
