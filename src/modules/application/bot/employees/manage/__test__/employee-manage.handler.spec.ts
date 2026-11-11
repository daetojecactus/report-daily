import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { JobRole, UserStatus } from 'src/modules/application/user/types/user.enums';
import type { UserChannel } from 'src/modules/application/user/channel/types/channel.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import type { User } from 'src/modules/application/user/types/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../../../core/access.service';
import type { BotActor } from '../../../core/types/bot.interface';
import type { MenuService } from '../../../core/menu.service';
import { createEmployee } from '../../../__test__/bot.fixture';
import { EmployeeManageHandler } from '../employee-manage.handler';
import type { ReportQueueProducer } from 'src/modules/queue/report/report-queue.producer';

const locale = new I18nService().getLocale(Language.EN);
const FOUND = createEmployee({ displayName: 'Anna *S*' });
const USER = FOUND.user;
const CHANNEL = FOUND.channel;
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
    setAdmin: vi.fn<UserService['setAdmin']>(),
  };
  const channelService = {
    findByUser: vi.fn<(userId: string) => Promise<UserChannel[]>>(),
  };
  const menuService = { syncEmployee: vi.fn() };
  const producer = { addReport: vi.fn<ReportQueueProducer['addReport']>() };
  const handler = new EmployeeManageHandler(
    userService as unknown as UserService,
    channelService as unknown as ChannelService,
    new AccessService(
      { get: () => [] } as unknown as ConfigService<AppEnvs, true>,
      {} as UserService,
      new I18nService(),
    ),
    menuService as unknown as MenuService,
    { get: () => 'Europe/London' } as unknown as ConfigService<AppEnvs, true>,
    producer as unknown as ReportQueueProducer,
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
    channelService.findByUser.mockResolvedValue([CHANNEL]);
  });

  it('offers the other roles', async () => {
    const { screen } = await open(`mng:role:${USER.id}`);

    expect(screen.text).toBe('**Anna \\*S\\***\nNow: Developer. Choose the new role.');
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

  it.each<[string, 'block' | 'unblock', string]>([
    ['block', 'block', 'Employee blocked: **Anna \\*S\\***.'],
    ['unblock', 'unblock', 'Employee unblocked: **Anna \\*S\\***.'],
  ])('can %s an employee', async (action, method, text) => {
    userService[method].mockResolvedValue(USER);

    const reply = await open(`mng:${action}:${USER.id}`);

    expect(userService[method]).toHaveBeenCalledWith(USER.id);
    expect(menuService.syncEmployee).toHaveBeenCalledWith(USER, [CHANNEL]);
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
    expect(menuService.syncEmployee).toHaveBeenCalledWith(null, [CHANNEL]);
    expect(reply.screen).toEqual({
      text: 'Employee deleted: **Anna \\*S\\***.',
      buttons: [[LIST]],
    });
  });

  it.each(['block', 'unblock', 'delete', 'confirm', 'admin', 'noadmin'])(
    'refuses to %s yourself',
    async (action) => {
      const reply = await open(`mng:${action}:${USER.id}`, { user: USER });

      expect(reply.screen).toEqual({
        text: locale.employeeManage.self,
        buttons: [[CARD]],
      });
      expect(userService.block).not.toHaveBeenCalled();
      expect(userService.deleteById).not.toHaveBeenCalled();
      expect(userService.setAdmin).not.toHaveBeenCalled();
    },
  );

  it('makes an employee an admin and back and refreshes the menu', async () => {
    userService.setAdmin.mockResolvedValueOnce({ ...USER, isAdmin: true });
    expect((await open(`mng:admin:${USER.id}`)).screen?.text).toBe(
      locale.employeeManage.madeAdmin('Anna \\*S\\*'),
    );

    userService.setAdmin.mockResolvedValueOnce(USER);
    expect((await open(`mng:noadmin:${USER.id}`)).screen?.text).toBe(
      locale.employeeManage.removedAdmin('Anna \\*S\\*'),
    );

    expect(userService.setAdmin.mock.calls).toEqual([
      [USER.id, true],
      [USER.id, false],
    ]);
    expect(menuService.syncEmployee).toHaveBeenCalledWith({ ...USER, isAdmin: true }, [CHANNEL]);
  });

  it('lets the owner change the role of an employee', async () => {
    await open(`mng:set:${USER.id}:devops`);

    expect(userService.changeRole).toHaveBeenCalledWith(USER.id, JobRole.DEVOPS);
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

  it('builds the report of today for the employee and tells the admin the outcome only', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-09T20:30:00Z') });

    expect(await open(`mng:report:${USER.id}`, { chatId: '77', externalId: '77' })).toEqual({
      screen: { text: locale.employeeManage.reportQueued('Anna \\*S\\*'), buttons: [[CARD]] },
      dialog: null,
    });
    expect(producer.addReport).toHaveBeenCalledWith({
      userId: USER.id,
      date: '2026-11-09',
      maxAgeMs: 300_000,
      channel: null,
      notice: {
        target: { channel: Channel.TELEGRAM, chatId: '77', externalId: '77' },
        empty: locale.employeeManage.reportEmpty('Anna \\*S\\*'),
        failed: locale.employeeManage.reportFailed('Anna \\*S\\*'),
      },
    });
    vi.useRealTimers();
  });

  it('refuses a report for an employee without a bound channel or not active', async () => {
    channelService.findByUser.mockResolvedValueOnce([]);
    userService.findById.mockResolvedValueOnce(USER).mockResolvedValueOnce({
      ...USER,
      status: UserStatus.BLOCKED,
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      expect((await open(`mng:report:${USER.id}`)).screen.text).toBe(
        locale.employeeManage.reportUnavailable('Anna \\*S\\*'),
      );
    }
    expect(producer.addReport).not.toHaveBeenCalled();
  });
});
