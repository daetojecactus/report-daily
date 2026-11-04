import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { JobRole, Permission } from 'src/modules/application/user/user.enums';
import type { User } from 'src/modules/application/user/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../../access/access.service';
import type { BotActor } from '../../bot.interface';
import { createEmployee } from '../../__test__/bot.fixture';
import { EmployeeManageHandler } from '../employee-manage.handler';

const locale = new I18nService().getLocale(Language.EN);
const USER = createEmployee({ displayName: 'Anna *S*' }).user;
const CARD = { text: 'Open the card', data: `emp:card:${USER.id}:0` };
const LIST = { text: 'To the list', data: 'emp:list:0' };

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('EmployeeManageHandler', () => {
  const userService = {
    findById: vi.fn<(id: string) => Promise<User | null>>(),
    changeRole: vi.fn(),
    block: vi.fn(),
    unblock: vi.fn(),
    deleteById: vi.fn(),
  };
  const handler = new EmployeeManageHandler(
    userService as unknown as UserService,
    new AccessService(
      { get: () => [] } as unknown as ConfigService<AppEnvs, true>,
      {} as UserService,
      new I18nService(),
    ),
  );

  function open(data: string, actor: Partial<BotActor> = {}) {
    return handler.handle({
      actor: {
        channel: Channel.TELEGRAM,
        externalId: '1',
        chatId: '1',
        language: Language.EN,
        isOwner: true,
        user: null,
        ...actor,
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
  });

  it('offers the other roles', async () => {
    const { screen } = await open(`mng:role:${USER.id}`);

    expect(screen.text).toBe(
      '**Anna \\*S\\***\nNow: Developer. Choose the new role.',
    );
    expect(screen.buttons).toEqual([
      [{ text: 'QA', data: `mng:set:${USER.id}:qa` }],
      [
        {
          text: 'Project manager',
          data: `mng:set:${USER.id}:project_manager`,
        },
      ],
      [{ text: 'System analyst', data: `mng:set:${USER.id}:system_analyst` }],
      [{ text: 'DevOps', data: `mng:set:${USER.id}:devops` }],
      [{ text: 'Cancel', data: `emp:card:${USER.id}:0` }],
    ]);
  });

  it('changes the role', async () => {
    const reply = await open(`mng:set:${USER.id}:qa`);

    expect(userService.changeRole).toHaveBeenCalledWith(USER.id, JobRole.QA);
    expect(reply).toEqual({
      screen: {
        text: 'Role changed: **Anna \\*S\\*** — QA.',
        buttons: [[CARD], [LIST]],
      },
      dialog: null,
    });
  });

  it.each<[string, keyof typeof userService, string]>([
    ['block', 'block', 'Employee blocked: **Anna \\*S\\***.'],
    ['unblock', 'unblock', 'Employee unblocked: **Anna \\*S\\***.'],
  ])('can %s an employee', async (action, method, text) => {
    const reply = await open(`mng:${action}:${USER.id}`);

    expect(userService[method]).toHaveBeenCalledWith(USER.id);
    expect(reply.screen.text).toContain(text);
    expect(reply.screen.buttons).toEqual([[CARD], [LIST]]);
  });

  it('asks before deleting', async () => {
    const reply = await open(`mng:delete:${USER.id}`);

    expect(userService.deleteById).not.toHaveBeenCalled();
    expect(reply.screen).toEqual({
      text: locale.employeeManage.confirmDelete('Anna \\*S\\*'),
      buttons: [
        [
          { text: 'Yes, delete', data: `mng:confirm:${USER.id}` },
          { text: 'Cancel', data: `emp:card:${USER.id}:0` },
        ],
      ],
    });
  });

  it('deletes after the confirmation', async () => {
    const reply = await open(`mng:confirm:${USER.id}`);

    expect(userService.deleteById).toHaveBeenCalledWith(USER.id);
    expect(reply.screen).toEqual({
      text: 'Employee deleted: **Anna \\*S\\***.',
      buttons: [[LIST]],
    });
  });

  it.each(['block', 'unblock', 'delete', 'confirm'])(
    'refuses to %s yourself',
    async (action) => {
      const reply = await open(`mng:${action}:${USER.id}`, {
        isOwner: false,
        user: { ...USER, permissions: [Permission.USERS] },
      });

      expect(reply.screen).toEqual({
        text: locale.employeeManage.self,
        buttons: [[CARD]],
      });
      expect(userService.block).not.toHaveBeenCalled();
      expect(userService.deleteById).not.toHaveBeenCalled();
    },
  );

  it('lets only an owner block an employee with permissions', async () => {
    userService.findById.mockResolvedValue({
      ...USER,
      permissions: [Permission.LABELS],
    });
    const admin = createEmployee({
      id: '019a4d2e-7c1b-7f3a-9c2d-000000000099',
      permissions: [Permission.USERS],
    }).user;

    const refused = await open(`mng:block:${USER.id}`, {
      isOwner: false,
      user: admin,
    });
    const allowed = await open(`mng:block:${USER.id}`);

    expect(refused.screen.text).toBe(locale.employeeManage.ownerOnly);
    expect(allowed.screen.text).toContain('Employee blocked');
    expect(userService.block).toHaveBeenCalledOnce();
  });

  it('lets an admin change the role of anyone', async () => {
    await open(`mng:set:${USER.id}:devops`, {
      isOwner: false,
      user: { ...USER, permissions: [Permission.USERS] },
    });

    expect(userService.changeRole).toHaveBeenCalledWith(
      USER.id,
      JobRole.DEVOPS,
    );
  });

  it('reports a deleted employee', async () => {
    userService.findById.mockResolvedValue(null);

    expect((await open(`mng:block:${USER.id}`)).screen).toEqual({
      text: locale.employees.notFound,
      buttons: [[LIST]],
    });
  });

  it.each([
    `mng:set:${USER.id}:boss`,
    `mng:set:${USER.id}`,
    'mng:block:not-a-uuid',
    `mng:other:${USER.id}`,
  ])('answers the outdated button %s', async (data) => {
    expect((await open(data)).screen).toEqual({ text: locale.bot.expired });
  });
});
