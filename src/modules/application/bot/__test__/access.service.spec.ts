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
import type { BotActor, BotSectionAccess } from '../bot.interface';
import { createEmployee, OWNER_ID } from './bot.fixture';

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
