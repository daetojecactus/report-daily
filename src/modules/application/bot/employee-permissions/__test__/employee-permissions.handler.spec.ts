import { Logger } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserChannel } from 'src/modules/application/user/channel/types/channel.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { Permission } from 'src/modules/application/user/types/user.enums';
import type { User } from 'src/modules/application/user/types/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { MenuService } from '../../menu/menu.service';
import { createEmployee } from '../../__test__/bot.fixture';
import { EmployeePermissionsHandler } from '../employee-permissions.handler';

const locale = new I18nService().getLocale(Language.EN);
const FOUND = createEmployee({
  displayName: 'Anna *S*',
  permissions: [Permission.USERS],
});
const USER = FOUND.user;

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('EmployeePermissionsHandler', () => {
  const userService = {
    findById: vi.fn<(id: string) => Promise<User | null>>(),
    grantPermission: vi.fn<(id: string, permission: Permission) => Promise<User | null>>(),
    revokePermission: vi.fn<(id: string, permission: Permission) => Promise<User | null>>(),
  };
  const channelService = {
    findByUser: vi.fn<(userId: string) => Promise<UserChannel[]>>(),
  };
  const menuService = { syncEmployee: vi.fn() };
  const handler = new EmployeePermissionsHandler(
    userService as unknown as UserService,
    channelService as unknown as ChannelService,
    menuService as unknown as MenuService,
  );

  function open(data: string) {
    return handler.handle({
      actor: {
        channel: Channel.TELEGRAM,
        externalId: '1',
        chatId: '1',
        language: Language.EN,
        isOwner: true,
        user: null,
      },
      locale,
      input: button(data),
      dialog: null,
    });
  }

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    userService.findById.mockResolvedValue(USER);
    channelService.findByUser.mockResolvedValue([FOUND.channel]);
  });

  it('shows every permission with its state and description', async () => {
    const { screen, dialog } = await open(`perm:open:${USER.id}`);

    expect(screen.text).toBe(
      [
        locale.employeePermissions.title('Anna \\*S\\*'),
        '',
        `**Employees** — ${locale.employeePermissions.descriptions.users}`,
        `**Traits** — ${locale.employeePermissions.descriptions.traits}`,
        `**Settings** — ${locale.employeePermissions.descriptions.settings}`,
        `**Templates** — ${locale.employeePermissions.descriptions.templates}`,
      ].join('\n'),
    );
    expect(screen.buttons).toEqual([
      [{ text: 'Employees: yes', data: `perm:revoke:${USER.id}:users` }],
      [{ text: 'Traits: no', data: `perm:grant:${USER.id}:traits` }],
      [{ text: 'Settings: no', data: `perm:grant:${USER.id}:settings` }],
      [{ text: 'Templates: no', data: `perm:grant:${USER.id}:templates` }],
      [{ text: 'Open the card', data: `emp:card:${USER.id}:0` }],
    ]);
    expect(dialog).toBeNull();
  });

  it('grants a permission and syncs the menu of the employee', async () => {
    const updated = {
      ...USER,
      permissions: [Permission.USERS, Permission.TRAITS],
    };
    userService.grantPermission.mockResolvedValue(updated);

    const { screen } = await open(`perm:grant:${USER.id}:traits`);

    expect(userService.grantPermission).toHaveBeenCalledWith(USER.id, Permission.TRAITS);
    expect(menuService.syncEmployee).toHaveBeenCalledWith(updated, [FOUND.channel]);
    expect(screen.buttons?.[1]).toEqual([
      { text: 'Traits: yes', data: `perm:revoke:${USER.id}:traits` },
    ]);
  });

  it('revokes a permission', async () => {
    userService.revokePermission.mockResolvedValue({
      ...USER,
      permissions: [],
    });

    const { screen } = await open(`perm:revoke:${USER.id}:users`);

    expect(userService.revokePermission).toHaveBeenCalledWith(USER.id, Permission.USERS);
    expect(screen.buttons?.[0]).toEqual([
      { text: 'Employees: no', data: `perm:grant:${USER.id}:users` },
    ]);
  });

  it('only shows the state when nothing changed', async () => {
    userService.grantPermission.mockResolvedValue(null);

    const { screen } = await open(`perm:grant:${USER.id}:users`);

    expect(menuService.syncEmployee).not.toHaveBeenCalled();
    expect(screen.buttons?.[0]).toEqual([
      { text: 'Employees: yes', data: `perm:revoke:${USER.id}:users` },
    ]);
  });

  it('reports a deleted employee', async () => {
    userService.findById.mockResolvedValue(null);

    expect((await open(`perm:open:${USER.id}`)).screen).toEqual({
      text: locale.employees.notFound,
      buttons: [[{ text: 'To the list', data: 'emp:list:0' }]],
    });
  });

  it.each([
    `perm:grant:${USER.id}:owner`,
    `perm:grant:${USER.id}`,
    'perm:open:not-a-uuid',
    `perm:other:${USER.id}`,
  ])('answers the outdated button %s', async (data) => {
    expect((await open(data)).screen).toEqual({ text: locale.bot.expired });
  });
});
