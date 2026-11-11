import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatChannel, ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserChannel } from 'src/modules/application/user/channel/types/channel.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { JobRole, Permission, UserStatus } from 'src/modules/application/user/types/user.enums';
import type { User } from 'src/modules/application/user/types/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { UserSource } from 'src/modules/application/user/user-source/types/user-source.interface';
import type { UserSourceService } from 'src/modules/application/user/user-source/user-source.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { ReportStatus } from 'src/modules/application/report/types/report.enums';
import type { Report } from 'src/modules/application/report/types/report.interface';
import type { ReportService } from 'src/modules/application/report/report.service';
import { GitLabRetryableError } from 'src/modules/vendors/gitlab/gitlab.error';
import type { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import { AccessService } from '../../core/access.service';
import type { BotActor, BotDialog } from '../../core/types/bot.interface';
import { createEmployee, createSourceAccount } from '../../__test__/bot.fixture';
import { EmployeesCard } from '../employees.card';
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
  const userSourceService = {
    findByUser: vi.fn<(userId: string) => Promise<UserSource[]>>(),
  };
  const reportService = { findLatest: vi.fn<ReportService['findLatest']>() };
  const gitlabService = { findLastActivityAt: vi.fn<GitLabService['findLastActivityAt']>() };
  const chatChannels = [{ channel: Channel.TELEGRAM }] as ChatChannel[];
  const handler = new EmployeesHandler(
    userService as unknown as UserService,
    new EmployeesCard(
      { get: () => 'Asia/Almaty' } as unknown as ConfigService<AppEnvs, true>,
      userService as unknown as UserService,
      channelService as unknown as ChannelService,
      userSourceService as unknown as UserSourceService,
      new AccessService(
        { get: () => [] } as unknown as ConfigService<AppEnvs, true>,
        {} as UserService,
        new I18nService(),
      ),
      reportService as unknown as ReportService,
      gitlabService as unknown as GitLabService,
      chatChannels,
    ),
  );

  function open(input: ChatInput, dialog: BotDialog | null = null, actor: Partial<BotActor> = {}) {
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
    chatChannels.splice(1);
    userSourceService.findByUser.mockResolvedValue([]);
    reportService.findLatest.mockResolvedValue(null as unknown as Report);
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
      [{ text: 'Next', data: 'emp:list:1' }],
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
    expect(screen.buttons?.[2]).toEqual([{ text: 'Back', data: 'emp:list:0' }]);
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
      permissions: [Permission.USERS, Permission.TRAITS],
    });
    userService.findById.mockResolvedValue(user);
    userSourceService.findByUser.mockResolvedValue([
      createSourceAccount({ userId: user.id, username: 'anna_s' }),
    ]);
    channelService.findByUser.mockResolvedValue([
      { ...createEmployee().channel, reachable: false },
    ]);
    gitlabService.findLastActivityAt.mockResolvedValue('2026-11-09T12:42:00Z');
    reportService.findLatest.mockResolvedValue({
      reportDate: '2026-11-08',
      status: ReportStatus.DELIVERED,
    } as Report);

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
        'Permissions: Employees, Traits',
        'Last activity in GitLab: 9 November at 17:42',
        'Last report: 8 November — delivered',
      ].join('\n'),
      buttons: [
        [{ text: 'Report now', data: `mng:report:${user.id}` }],
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
    expect(screen.text).not.toContain('Last activity');
    expect(screen.text).toContain('Last report: none yet');
    expect(screen.buttons?.flat().map((item) => item.text)).not.toContain('Report now');
  });

  it('tells when the GitLab activity is hidden or cannot be checked', async () => {
    const user = employee(1);
    userService.findById.mockResolvedValue(user);
    userSourceService.findByUser.mockResolvedValue([createSourceAccount({ userId: user.id })]);
    channelService.findByUser.mockResolvedValue([]);
    gitlabService.findLastActivityAt
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new GitLabRetryableError('GitLab answered 502'));

    expect((await open(button(`emp:card:${user.id}:0`))).screen.text).toContain(
      `Last activity in GitLab: ${locale.employees.card.activityHidden}`,
    );
    expect((await open(button(`emp:card:${user.id}:0`))).screen.text).toContain(
      `Last activity in GitLab: ${locale.employees.card.activityUnknown}`,
    );
  });

  it('offers a report now to an employee who has only Slack', async () => {
    const user = employee(1);
    userService.findById.mockResolvedValue(user);
    channelService.findByUser.mockResolvedValue([
      { ...createEmployee().channel, channel: Channel.SLACK, externalId: 'U0ANNA01' },
    ]);

    expect((await open(button(`emp:card:${user.id}:0`))).screen.buttons?.[0]).toEqual([
      { text: 'Report now', data: `mng:report:${user.id}` },
    ]);
  });

  it('offers to bind every configured channel the employee does not have', async () => {
    const user = employee(1);
    userService.findById.mockResolvedValue(user);
    channelService.findByUser.mockResolvedValue([]);
    chatChannels.push({ channel: Channel.SLACK } as ChatChannel);

    expect((await open(button(`emp:card:${user.id}:3`))).screen.buttons?.[0]).toEqual([
      { text: 'Bind Telegram', data: `bind:start:${user.id}:telegram` },
      { text: 'Bind Slack', data: `bind:start:${user.id}:slack` },
    ]);

    channelService.findByUser.mockResolvedValue([createEmployee().channel]);

    expect(
      (await open(button(`emp:card:${user.id}:3`), null, { channel: Channel.SLACK })).screen
        .buttons,
    ).toContainEqual([{ text: 'Bind Slack', data: `bind:start:${user.id}:slack` }]);
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
      { permissions: [Permission.TRAITS] },
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

    const { screen } = await open(button(`emp:card:${user.id}:0`), null, toActor(user));

    expect(screen.buttons).toEqual([
      [{ text: 'Report now', data: `mng:report:${user.id}` }],
      [{ text: 'Change role', data: `mng:role:${user.id}` }],
      [{ text: 'To the list', data: 'emp:list:0' }],
    ]);
  });

  it('hides binding from an admin who cannot manage the employee', async () => {
    const user = employee(1, { permissions: [Permission.TRAITS] });
    userService.findById.mockResolvedValue(user);
    channelService.findByUser.mockResolvedValue([]);
    const admin = { isOwner: false, user: employee(9, { permissions: [Permission.USERS] }) };

    const { screen } = await open(button(`emp:card:${user.id}:0`), null, admin);
    const owners = await open(button(`emp:card:${user.id}:0`));

    expect(JSON.stringify(screen.buttons)).not.toContain('bind:start');
    expect(JSON.stringify(owners.screen.buttons)).toContain(`bind:start:${user.id}:telegram`);
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
    userService.search.mockResolvedValue(Array.from({ length: 11 }, (_, index) => employee(index)));

    const { screen } = await open(text('employee'), SEARCH_DIALOG);

    expect(screen.text).toBe('**Search:** employee\nShowing the first 10, refine the search.');
    expect(screen.buttons).toHaveLength(11);
  });

  it.each(['   ', '@', 'x'.repeat(65)])('asks again for the query %j', async (query) => {
    const { screen, dialog } = await open(text(query), SEARCH_DIALOG);

    expect(userService.search).not.toHaveBeenCalled();
    expect(screen.text).toBe(locale.employees.searchPrompt);
    expect(dialog).toEqual(SEARCH_DIALOG);
  });

  it.each(['emp:card:not-a-uuid:0', 'emp:list:x', 'emp:list:', 'emp:list:1:2', 'emp:delete:1'])(
    'answers the outdated button %s',
    async (data) => {
      expect((await open(button(data))).screen).toEqual({
        text: locale.bot.expired,
      });
    },
  );
});
