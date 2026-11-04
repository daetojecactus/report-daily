import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserChannel } from 'src/modules/application/user/channel/channel.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import {
  JobRole,
  Permission,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import type { User } from 'src/modules/application/user/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../../access/access.service';
import type { BotActor, BotDialog } from '../../bot.interface';
import { createEmployee } from '../../__test__/bot.fixture';
import { EmployeesHandler } from '../employees.handler';

const locale = new I18nService().getLocale(Language.EN);
const ID = '019a4d2e-7c1b-7f3a-9c2d-1234567890ab';
const SEARCH_DIALOG: BotDialog = { namespace: 'emp', step: 'search', data: {} };

function employee(index: number, values: Partial<User> = {}): User {
  return createEmployee({
    id: `019a4d2e-7c1b-7f3a-9c2d-${String(index).padStart(12, '0')}`,
    displayName: `Employee ${index}`,
    ...values,
  }).user;
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

function text(value: string): ChatInput {
  return { type: ChatInputType.TEXT, text: value };
}

describe('EmployeesHandler', () => {
  const userService = {
    count: vi.fn<() => Promise<number>>(),
    findPage: vi.fn<(limit: number, offset: number) => Promise<User[]>>(),
    findById: vi.fn<(id: string) => Promise<User | null>>(),
    search: vi.fn<(query: string, limit: number) => Promise<User[]>>(),
  };
  const channelService = {
    findByUser: vi.fn<(userId: string) => Promise<UserChannel[]>>(),
  };
  const handler = new EmployeesHandler(
    userService as unknown as UserService,
    channelService as unknown as ChannelService,
    new AccessService(
      { get: () => [] } as unknown as ConfigService<AppEnvs, true>,
      {} as UserService,
      new I18nService(),
    ),
  );

  function open(
    input: ChatInput,
    dialog: BotDialog | null = null,
    actor: Partial<BotActor> = {},
  ) {
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
      input,
      dialog,
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows the first page with navigation, search and menu', async () => {
    userService.count.mockResolvedValue(20);
    userService.findPage.mockResolvedValue([employee(1), employee(2)]);

    const { screen, dialog } = await open(button('emp:list:0'));

    expect(userService.findPage).toHaveBeenCalledWith(8, 0);
    expect(screen.text).toBe('**Employees** · 20\nPage 1 of 3');
    expect(screen.buttons).toEqual([
      [
        {
          text: 'Employee 1 · Developer',
          data: `emp:card:${employee(1).id}:0`,
        },
      ],
      [
        {
          text: 'Employee 2 · Developer',
          data: `emp:card:${employee(2).id}:0`,
        },
      ],
      [{ text: 'Next ›', data: 'emp:list:1' }],
      [
        { text: 'Search', data: 'emp:search' },
        { text: 'Add', data: 'add:start' },
        { text: 'Menu', data: 'adm:menu' },
      ],
    ]);
    expect(dialog).toBeNull();
  });

  it('moves a page beyond the end to the last page', async () => {
    userService.count.mockResolvedValue(10);
    userService.findPage.mockResolvedValue([employee(9), employee(10)]);

    const { screen } = await open(button('emp:list:9'));

    expect(userService.findPage).toHaveBeenCalledWith(8, 8);
    expect(screen.text).toBe('**Employees** · 10\nPage 2 of 2');
    expect(screen.buttons?.[2]).toEqual([
      { text: '‹ Back', data: 'emp:list:0' },
    ]);
  });

  it('shows an empty list', async () => {
    userService.count.mockResolvedValue(0);
    userService.findPage.mockResolvedValue([]);

    const { screen } = await open(button('emp:list:0'));

    expect(screen).toEqual({
      text: '**Employees** · 0\nNo employees yet.',
      buttons: [
        [
          { text: 'Search', data: 'emp:search' },
          { text: 'Add', data: 'add:start' },
          { text: 'Menu', data: 'adm:menu' },
        ],
      ],
    });
  });

  it('adds the status of an employee who is not active', async () => {
    userService.count.mockResolvedValue(1);
    userService.findPage.mockResolvedValue([
      employee(1, { role: JobRole.QA, status: UserStatus.BLOCKED }),
    ]);

    const { screen } = await open(button('emp:list:0'));

    expect(screen.buttons?.[0][0].text).toBe('Employee 1 · QA · blocked');
  });

  it('shows a card with channels and permissions', async () => {
    const user = employee(1, {
      displayName: 'Anna *Smirnova*',
      gitlabUsername: 'anna_s',
      permissions: [Permission.USERS, Permission.LABELS],
    });
    userService.findById.mockResolvedValue(user);
    channelService.findByUser.mockResolvedValue([
      { ...createEmployee().channel, reachable: false },
    ]);

    const { screen } = await open(button(`emp:card:${user.id}:2`));

    expect(userService.findById).toHaveBeenCalledWith(user.id);
    expect(screen).toEqual({
      text: [
        '**Anna \\*Smirnova\\***',
        'GitLab: @anna\\_s',
        'Role: Developer',
        'Gender: male',
        'Status: active',
        'Telegram: unreachable, the bot is blocked',
        'Permissions: Employees, Labels',
      ].join('\n'),
      buttons: [
        [{ text: 'Change role', data: `mng:role:${user.id}` }],
        [{ text: 'Permissions', data: `perm:open:${user.id}` }],
        [
          { text: 'Block', data: `mng:block:${user.id}` },
          { text: 'Delete', data: `mng:delete:${user.id}` },
        ],
        [{ text: 'To the list', data: 'emp:list:2' }],
      ],
    });
  });

  it('shows a card of an employee without channels', async () => {
    userService.findById.mockResolvedValue(employee(1));
    channelService.findByUser.mockResolvedValue([]);

    const { screen } = await open(button(`emp:card:${ID}:0`));

    expect(screen.text).toContain('Channels: not connected');
    expect(screen.text).not.toContain('Permissions');
  });

  it('offers to bind the channel of the admin when it is missing', async () => {
    const user = employee(1);
    userService.findById.mockResolvedValue(user);
    channelService.findByUser.mockResolvedValue([]);

    const { screen } = await open(button(`emp:card:${user.id}:3`));

    expect(screen.buttons?.[0]).toEqual([
      { text: 'Bind Telegram', data: `bind:start:${user.id}` },
    ]);
  });

  it('offers to unblock a blocked employee', async () => {
    const user = employee(1, { status: UserStatus.BLOCKED });
    userService.findById.mockResolvedValue(user);
    channelService.findByUser.mockResolvedValue([createEmployee().channel]);

    const { screen } = await open(button(`emp:card:${user.id}:0`));

    expect(screen.buttons?.[2]).toEqual([
      { text: 'Unblock', data: `mng:unblock:${user.id}` },
      { text: 'Delete', data: `mng:delete:${user.id}` },
    ]);
  });

  it.each<[string, Partial<User>, (user: User) => Partial<BotActor>]>([
    [
      'an admin with permissions to another admin',
      { permissions: [Permission.LABELS] },
      () => ({
        isOwner: false,
        user: employee(9, { permissions: [Permission.USERS] }),
      }),
    ],
    ['an admin to themselves', {}, (user) => ({ isOwner: false, user })],
  ])('hides block and delete from %s', async (_name, values, toActor) => {
    const user = employee(1, values);
    userService.findById.mockResolvedValue(user);
    channelService.findByUser.mockResolvedValue([createEmployee().channel]);

    const { screen } = await open(
      button(`emp:card:${user.id}:0`),
      null,
      toActor(user),
    );

    expect(screen.buttons).toEqual([
      [{ text: 'Change role', data: `mng:role:${user.id}` }],
      [{ text: 'To the list', data: 'emp:list:0' }],
    ]);
  });

  it('reports a deleted employee', async () => {
    userService.findById.mockResolvedValue(null);

    const { screen } = await open(button(`emp:card:${ID}:1`));

    expect(screen).toEqual({
      text: locale.employees.notFound,
      buttons: [[{ text: 'To the list', data: 'emp:list:1' }]],
    });
  });

  it('asks for a query and starts a dialog', async () => {
    const { screen, dialog } = await open(button('emp:search'));

    expect(screen.text).toBe(locale.employees.searchPrompt);
    expect(dialog).toEqual(SEARCH_DIALOG);
  });

  it('searches by name or username without a leading @', async () => {
    userService.search.mockResolvedValue([employee(1)]);

    const { screen, dialog } = await open(text(' @anna_s '), SEARCH_DIALOG);

    expect(userService.search).toHaveBeenCalledWith('anna_s', 11);
    expect(screen).toEqual({
      text: '**Search:** anna\\_s',
      buttons: [
        [
          {
            text: 'Employee 1 · Developer',
            data: `emp:card:${employee(1).id}:0`,
          },
        ],
        [
          { text: 'Search', data: 'emp:search' },
          { text: 'To the list', data: 'emp:list:0' },
        ],
      ],
    });
    expect(dialog).toBeNull();
  });

  it('reports a search without matches', async () => {
    userService.search.mockResolvedValue([]);

    const { screen } = await open(text('nobody'), SEARCH_DIALOG);

    expect(screen.text).toBe('**Search:** nobody\nNobody found.');
  });

  it('shows the first ten matches and asks to refine the query', async () => {
    userService.search.mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => employee(index)),
    );

    const { screen } = await open(text('employee'), SEARCH_DIALOG);

    expect(screen.text).toBe(
      '**Search:** employee\nShowing the first 10, refine the search.',
    );
    expect(screen.buttons).toHaveLength(11);
  });

  it.each(['   ', '@', 'x'.repeat(65)])(
    'asks again for the query %j',
    async (query) => {
      const { screen, dialog } = await open(text(query), SEARCH_DIALOG);

      expect(userService.search).not.toHaveBeenCalled();
      expect(screen.text).toBe(locale.employees.searchPrompt);
      expect(dialog).toEqual(SEARCH_DIALOG);
    },
  );

  it.each([
    'emp:card:not-a-uuid:0',
    'emp:list:x',
    'emp:list:',
    'emp:list:1:2',
    'emp:delete:1',
  ])('answers the outdated button %s', async (data) => {
    expect((await open(button(data))).screen).toEqual({
      text: locale.bot.expired,
    });
  });
});
