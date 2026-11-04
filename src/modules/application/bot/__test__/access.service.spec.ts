import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import {
  Permission,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../access/access.service';
import { BotAccess } from '../bot.enums';
import type { User } from 'src/modules/application/user/user.interface';
import type { BotActor, BotSectionAccess } from '../bot.interface';
import { createEmployee, OWNER_ID } from './bot.fixture';

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

const LEVELS: BotSectionAccess[] = [
  BotAccess.ANYONE,
  BotAccess.EMPLOYEE,
  BotAccess.ADMIN,
  BotAccess.OWNER,
  Permission.USERS,
  Permission.LABELS,
];

describe('AccessService', () => {
  it.each([
    ['a stranger', actor({}), [BotAccess.ANYONE]],
    [
      'an employee',
      actor({ user: createEmployee().user }),
      [BotAccess.ANYONE, BotAccess.EMPLOYEE],
    ],
    [
      'an admin with the users permission',
      actor({ user: createEmployee({ permissions: [Permission.USERS] }).user }),
      [BotAccess.ANYONE, BotAccess.EMPLOYEE, BotAccess.ADMIN, Permission.USERS],
    ],
    [
      'an owner',
      actor({ isOwner: true }),
      [
        BotAccess.ANYONE,
        BotAccess.ADMIN,
        BotAccess.OWNER,
        Permission.USERS,
        Permission.LABELS,
      ],
    ],
    [
      'an owner who is an employee',
      actor({ isOwner: true, user: createEmployee().user }),
      LEVELS,
    ],
  ])('grants %s only its access levels', (_name, subject, allowed) => {
    const { service } = createService();

    expect(LEVELS.filter((level) => service.isAllowed(subject, level))).toEqual(
      allowed,
    );
  });

  it.each<[string, Partial<BotActor>, Partial<User>, boolean]>([
    [
      'an admin by an owner',
      { isOwner: true },
      { permissions: [Permission.USERS] },
      true,
    ],
    [
      'an employee by an admin',
      {
        user: createEmployee({ id: ADMIN_ID, permissions: [Permission.USERS] })
          .user,
      },
      {},
      true,
    ],
    [
      'an admin by another admin',
      {
        user: createEmployee({ id: ADMIN_ID, permissions: [Permission.USERS] })
          .user,
      },
      { permissions: [Permission.LABELS] },
      false,
    ],
    ['yourself as an admin', { user: createEmployee().user }, {}, false],
    [
      'your own employee record as an owner',
      { isOwner: true, user: createEmployee().user },
      {},
      false,
    ],
  ])(
    'decides whether %s can be managed',
    (_name, subject, target, canManage) => {
      const { service } = createService();

      expect(
        service.canManage(actor(subject), createEmployee(target).user),
      ).toBe(canManage);
    },
  );

  it.each<[string, Partial<User>, string, boolean, boolean]>([
    ['an active employee', {}, '555', false, true],
    ['a blocked employee', { status: UserStatus.BLOCKED }, '555', false, false],
    ['an owner who is an employee', {}, OWNER_ID, true, true],
  ])(
    'builds the actor of %s for the menu',
    (_name, values, externalId, isOwner, isEmployee) => {
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
    },
  );

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

    expect(resolved.user).toBe(found.user);
    expect(resolved.language).toBe(Language.RU);
    expect(userService.recordContact).toHaveBeenCalledWith(found, Language.RU);
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

    expect(resolved.user).toBeNull();
    expect(service.isKnown(resolved)).toBe(false);
    expect(userService.recordContact).not.toHaveBeenCalled();
  });
});
