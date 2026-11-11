import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { UserStatus } from 'src/modules/application/user/types/user.enums';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../access.service';
import { BotAccess } from '../types/bot.enums';
import type { User } from 'src/modules/application/user/types/user.interface';
import type { BotActor } from '../types/bot.interface';
import { createEmployee, OWNER_ID } from '../../__test__/bot.fixture';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';

const ADMIN_ID = '019a4d2e-7c1b-7f3a-9c2d-000000000077';

function createService(found: ReturnType<typeof createEmployee> | null = null) {
  const userService = {
    findOneByChannel: vi.fn().mockResolvedValue(found),
    recordContact: vi.fn().mockResolvedValue(undefined),
  };
  const configService = { get: () => [OWNER_ID] };
  const service = new AccessService(
    configService as unknown as ConfigService<AppEnvs, true>,
    userService as unknown as UserService,
    new I18nService(),
  );
  return { service, userService };
}

function actor(values: Partial<BotActor>): BotActor {
  return {
    channel: Channel.TELEGRAM,
    externalId: '1',
    chatId: '1',
    language: Language.EN,
    isOwner: false,
    user: null,
    ...values,
  };
}

const LEVELS: BotAccess[] = [
  BotAccess.ANYONE,
  BotAccess.EMPLOYEE,
  BotAccess.ADMIN,
  BotAccess.OWNER,
];

describe('AccessService', () => {
  it.each([
    ['a stranger', actor({}), [BotAccess.ANYONE]],
    ['an employee', actor({ user: createEmployee().user }), [BotAccess.ANYONE, BotAccess.EMPLOYEE]],
    [
      'an admin',
      actor({ user: createEmployee({ isAdmin: true }).user }),
      [BotAccess.ANYONE, BotAccess.EMPLOYEE, BotAccess.ADMIN],
    ],
    ['an owner', actor({ isOwner: true }), [BotAccess.ANYONE, BotAccess.ADMIN, BotAccess.OWNER]],
    ['an owner who is an employee', actor({ isOwner: true, user: createEmployee().user }), LEVELS],
  ])('grants %s only its access levels', (_name, subject, allowed) => {
    const { service } = createService();

    expect(LEVELS.filter((level) => service.isAllowed(subject, level))).toEqual(allowed);
  });

  it.each<[string, Partial<BotActor>, Partial<User>, boolean]>([
    ['an employee by an owner', { isOwner: true }, {}, true],
    ['an admin by an owner', { isOwner: true }, { isAdmin: true }, true],
    [
      'an employee by an admin',
      { user: createEmployee({ id: ADMIN_ID, isAdmin: true }).user },
      {},
      false,
    ],
    [
      'your own employee record as an owner',
      { isOwner: true, user: createEmployee().user },
      {},
      false,
    ],
  ])('decides whether %s can be managed', (_name, subject, target, canManage) => {
    const { service } = createService();

    expect(service.canManage(actor(subject), createEmployee(target).user)).toBe(canManage);
  });

  it.each<[string, Partial<User>, string, boolean, boolean]>([
    ['an active employee', {}, '555', false, true],
    ['a blocked employee', { status: UserStatus.BLOCKED }, '555', false, false],
    ['an owner who is an employee', {}, OWNER_ID, true, true],
  ])('builds the actor of %s for the menu', (_name, values, externalId, isOwner, isEmployee) => {
    const { service } = createService();
    const found = createEmployee({ language: null, ...values });

    const result = service.toActor(found.user, {
      ...found.channel,
      externalId,
    });

    expect(result).toMatchObject({
      channel: Channel.TELEGRAM,
      externalId,
      chatId: externalId,
      language: Language.EN,
      isOwner,
    });
    expect(result.user !== null).toBe(isEmployee);
  });

  it('builds a stranger actor for a deleted employee', () => {
    const { service } = createService();

    expect(service.toActor(null, createEmployee().channel)).toMatchObject({
      isOwner: false,
      user: null,
    });
  });

  it('resolves an owner from the environment', async () => {
    const { service } = createService();

    const resolved = await service.resolveActor({
      channel: Channel.TELEGRAM,
      userId: OWNER_ID,
      chatId: OWNER_ID,
      languageCode: 'ru',
      input: { type: ChatInputType.TEXT, text: 'hi' },
    });

    expect(resolved).toMatchObject({
      isOwner: true,
      user: null,
      language: Language.RU,
    });
  });

  it('records the contact of an active employee', async () => {
    const found = createEmployee({ language: null });
    const { service, userService } = createService(found);

    const resolved = await service.resolveActor({
      channel: Channel.TELEGRAM,
      userId: found.channel.externalId,
      chatId: found.channel.externalId,
      languageCode: 'ru',
      input: { type: ChatInputType.TEXT, text: 'hi' },
    });

    expect(resolved?.user).toBe(found.user);
    expect(resolved?.language).toBe(Language.RU);
    expect(userService.recordContact).toHaveBeenCalledWith(found, Language.RU);
  });

  it('asks the channel for the language only when neither the employee nor the update has it', async () => {
    const found = createEmployee({ language: null });
    const { service, userService } = createService(found);
    const findLanguageCode = vi.fn().mockResolvedValue('ru-RU');
    const event = {
      channel: Channel.SLACK,
      userId: found.channel.externalId,
      chatId: found.channel.externalId,
      languageCode: null,
      input: { type: ChatInputType.TEXT, text: 'hi' },
    } as const;

    const resolved = await service.resolveActor(event, findLanguageCode);

    expect(resolved?.language).toBe(Language.RU);
    expect(userService.recordContact).toHaveBeenCalledWith(found, Language.RU);

    findLanguageCode.mockClear();
    const known = createService(createEmployee({ language: Language.EN })).service;
    expect((await known.resolveActor(event, findLanguageCode))?.language).toBe(Language.EN);
    await service.resolveActor({ ...event, languageCode: 'en' }, findLanguageCode);
    expect(findLanguageCode).not.toHaveBeenCalled();
  });

  it('hides a blocked employee', async () => {
    const found = createEmployee({ status: UserStatus.BLOCKED });
    const { service, userService } = createService(found);

    const resolved = await service.resolveActor({
      channel: Channel.TELEGRAM,
      userId: found.channel.externalId,
      chatId: found.channel.externalId,
      languageCode: null,
      input: { type: ChatInputType.TEXT, text: 'hi' },
    });

    expect(resolved).toMatchObject({ user: null, isOwner: false });
    expect(service.isKnown(resolved!)).toBe(false);
    expect(userService.recordContact).not.toHaveBeenCalled();
  });

  describe('owners by channel', () => {
    const create = (env: Record<string, string[] | undefined>) =>
      new AccessService(
        { get: (key: string) => env[key] } as unknown as ConfigService<AppEnvs, true>,
        {
          findOneByChannel: vi.fn().mockResolvedValue(null),
          recordContact: vi.fn(),
        } as unknown as UserService,
        new I18nService(),
      );
    const isOwner = async (service: AccessService, channel: Channel, userId: string) => {
      const resolved = await service.resolveActor({
        channel,
        userId,
        chatId: userId,
        languageCode: 'en',
        input: { type: ChatInputType.COMMAND, command: 'start' },
      });
      return resolved?.isOwner ?? false;
    };

    it('knows the owners of each channel by their own ids', async () => {
      const service = create({ OWNER_TELEGRAM_IDS: ['100'], OWNER_SLACK_IDS: ['U0OWNER01'] });

      expect(await isOwner(service, Channel.SLACK, 'U0OWNER01')).toBe(true);
      expect(await isOwner(service, Channel.TELEGRAM, '100')).toBe(true);
      expect(await isOwner(service, Channel.SLACK, '100')).toBe(false);
      expect(await isOwner(service, Channel.TELEGRAM, 'U0OWNER01')).toBe(false);
    });

    it('has no Slack owners without the Slack variables', async () => {
      const service = create({ OWNER_TELEGRAM_IDS: ['100'] });

      expect(await isOwner(service, Channel.SLACK, 'U0OWNER01')).toBe(false);
      expect(service.listOwners().map(({ channel, chatId }) => [channel, chatId])).toEqual([
        [Channel.TELEGRAM, '100'],
      ]);
    });

    it('resolves nobody for a person who is neither an owner nor in the database', async () => {
      const findLanguageCode = vi.fn().mockResolvedValue('ru-RU');

      expect(
        await create({ OWNER_TELEGRAM_IDS: ['100'] }).resolveActor(
          {
            channel: Channel.SLACK,
            userId: 'U0STRANGE1',
            chatId: 'U0STRANGE1',
            languageCode: null,
            input: { type: ChatInputType.TEXT, text: 'hi' },
          },
          findLanguageCode,
        ),
      ).toBeNull();
      expect(findLanguageCode).not.toHaveBeenCalled();
    });
  });
});
