import { Logger } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { Source } from 'src/modules/application/source/types/source.enums';
import { Gender, JobRole, UserStatus } from 'src/modules/application/user/types/user.enums';
import type { User, UserInsert } from 'src/modules/application/user/types/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { UserSourceInsert } from 'src/modules/application/user/user-source/types/user-source.interface';
import {
  GitLabCertificateError,
  GitLabRejectedError,
  GitLabRetryableError,
} from 'src/modules/vendors/gitlab/gitlab.error';
import type { GitLabUser } from 'src/modules/vendors/gitlab/types/gitlab.interface';
import type { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import type { BotDialog } from '../../types/bot.interface';
import { createEmployee } from '../../__test__/bot.fixture';
import type { EmployeesCard } from '../../employees/employees.card';
import { EmployeeAddHandler } from '../employee-add.handler';

const locale = new I18nService().getLocale(Language.EN);
const CANDIDATE = { id: 501, username: 'anna_s', name: 'Anna *Smirnova*' };
const GITLAB_USER: GitLabUser = {
  ...CANDIDATE,
  state: 'active',
  avatar_url: 'https://gitlab.example.com/avatar.png',
  web_url: 'https://gitlab.example.com/anna_s',
};
const CANCEL = { text: 'Cancel', data: 'add:cancel' };

function dialog(step: string, data: Record<string, unknown>): BotDialog {
  return { namespace: 'add', step, data };
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

function text(value: string): ChatInput {
  return { type: ChatInputType.TEXT, text: value };
}

describe('EmployeeAddHandler', () => {
  const userService = {
    findOneBySource: vi.fn<(source: Source, externalId: string) => Promise<User | null>>(),
    createWithSource:
      vi.fn<(values: UserInsert, account: Omit<UserSourceInsert, 'userId'>) => Promise<User>>(),
  };
  const gitlabService = {
    searchUsers: vi.fn<(query: string) => Promise<GitLabUser[]>>(),
    hasVisibleActivity: vi.fn<(id: number) => Promise<boolean>>(),
  };
  const employeesCard = {
    toBindButtons: (_locale: unknown, userId: string) => [
      { text: 'Bind Telegram', data: `bind:start:${userId}:telegram` },
      { text: 'Bind Slack', data: `bind:start:${userId}:slack` },
    ],
  };
  const handler = new EmployeeAddHandler(
    userService as unknown as UserService,
    gitlabService as unknown as GitLabService,
    employeesCard as unknown as EmployeesCard,
  );

  function open(input: ChatInput, current: BotDialog | null = null) {
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
      input,
      dialog: current,
    });
  }

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    userService.findOneBySource.mockResolvedValue(null);
  });

  it('asks for a GitLab query', async () => {
    expect(await open(button('add:start'))).toEqual({
      screen: { text: locale.employeeAdd.prompt, buttons: [[CANCEL]] },
      dialog: dialog('query', {}),
    });
  });

  it('offers the GitLab matches without a leading @', async () => {
    gitlabService.searchUsers.mockResolvedValue([GITLAB_USER]);

    const reply = await open(text(' @anna '), dialog('query', {}));

    expect(gitlabService.searchUsers).toHaveBeenCalledWith('anna');
    expect(reply).toEqual({
      screen: {
        text: '**GitLab:** anna\nChoose the employee.',
        buttons: [[{ text: 'Anna *Smirnova* · @anna_s', data: 'add:pick:501' }], [CANCEL]],
      },
      dialog: dialog('pick', { candidates: [CANDIDATE] }),
    });
  });

  it.each(['  ', '@', 'x'.repeat(65)])('asks again for the query %j', async (query) => {
    const reply = await open(text(query), dialog('query', {}));

    expect(gitlabService.searchUsers).not.toHaveBeenCalled();
    expect(reply.screen.text).toBe(locale.employeeAdd.prompt);
    expect(reply.dialog).toEqual(dialog('query', {}));
  });

  it('asks for another query when GitLab finds nobody', async () => {
    gitlabService.searchUsers.mockResolvedValue([]);

    const reply = await open(text('nobody'), dialog('query', {}));

    expect(reply.screen.text).toBe(locale.employeeAdd.noMatches);
    expect(reply.dialog).toEqual(dialog('query', {}));
  });

  it.each([new GitLabRetryableError('timeout'), new GitLabRejectedError('unauthorized', 401)])(
    'keeps the dialog when GitLab fails with %s',
    async (error) => {
      gitlabService.searchUsers.mockRejectedValue(error);

      const reply = await open(text('anna'), dialog('query', {}));

      expect(reply.screen.text).toBe(locale.employeeAdd.gitlabUnavailable);
      expect(reply.dialog).toEqual(dialog('query', {}));
    },
  );

  it('asks the owner to set up the CA certificate of GitLab', async () => {
    gitlabService.searchUsers.mockRejectedValue(
      new GitLabCertificateError('UNABLE_TO_VERIFY_LEAF_SIGNATURE'),
    );

    const reply = await open(text('anna'), dialog('query', {}));

    expect(reply.screen.text).toBe(locale.employeeAdd.gitlabCertificate);
    expect(reply.dialog).toEqual(dialog('query', {}));
  });

  it('rethrows unexpected errors', async () => {
    gitlabService.searchUsers.mockRejectedValue(new Error('bug'));

    await expect(open(text('anna'), dialog('query', {}))).rejects.toThrow('bug');
  });

  it('asks for the role of the picked user', async () => {
    const reply = await open(button('add:pick:501'), dialog('pick', { candidates: [CANDIDATE] }));

    expect(reply.screen.text).toBe('**Anna \\*Smirnova\\***\nChoose the role.');
    expect(reply.screen.buttons).toEqual([
      [{ text: 'Developer', data: 'add:role:developer' }],
      [{ text: 'QA', data: 'add:role:qa' }],
      [{ text: 'Project manager', data: 'add:role:project_manager' }],
      [{ text: 'System analyst', data: 'add:role:system_analyst' }],
      [{ text: 'DevOps', data: 'add:role:devops' }],
      [CANCEL],
    ]);
    expect(reply.dialog).toEqual(dialog('role', { candidate: CANDIDATE }));
  });

  it('opens the card of a user who is already an employee', async () => {
    const existing = createEmployee({ displayName: 'Anna' }).user;
    userService.findOneBySource.mockResolvedValue(existing);

    const reply = await open(button('add:pick:501'), dialog('pick', { candidates: [CANDIDATE] }));

    expect(reply).toEqual({
      screen: {
        text: '**Anna** is already an employee.',
        buttons: [[{ text: 'Open the card', data: `emp:card:${existing.id}:0` }]],
      },
      dialog: null,
    });
  });

  it('asks for the gender after the role', async () => {
    const reply = await open(button('add:role:qa'), dialog('role', { candidate: CANDIDATE }));

    expect(reply).toEqual({
      screen: {
        text: '**Anna \\*Smirnova\\***\nChoose the gender.',
        buttons: [
          [
            { text: 'male', data: 'add:gender:male' },
            { text: 'female', data: 'add:gender:female' },
          ],
          [CANCEL],
        ],
      },
      dialog: dialog('gender', { candidate: CANDIDATE, role: JobRole.QA }),
    });
  });

  it('creates a pending employee after the gender', async () => {
    const created = createEmployee({
      displayName: CANDIDATE.name,
      status: UserStatus.PENDING,
    }).user;
    userService.createWithSource.mockResolvedValue(created);
    gitlabService.hasVisibleActivity.mockResolvedValue(true);

    const reply = await open(
      button('add:gender:female'),
      dialog('gender', { candidate: CANDIDATE, role: JobRole.QA }),
    );

    expect(userService.findOneBySource).toHaveBeenCalledWith(Source.GITLAB, '501');
    expect(userService.createWithSource).toHaveBeenCalledWith(
      {
        displayName: 'Anna *Smirnova*',
        role: JobRole.QA,
        gender: Gender.FEMALE,
      },
      { source: Source.GITLAB, externalId: '501', username: 'anna_s' },
    );
    expect(gitlabService.hasVisibleActivity).toHaveBeenCalledWith(501);
    expect(reply).toEqual({
      screen: {
        text: ['Employee added: **Anna \\*Smirnova\\***.', locale.employeeAdd.pending].join('\n\n'),
        buttons: [
          [
            { text: 'Bind Telegram', data: `bind:start:${created.id}:telegram` },
            { text: 'Bind Slack', data: `bind:start:${created.id}:slack` },
          ],
          [{ text: 'Open the card', data: `emp:card:${created.id}:0` }],
          [{ text: 'To the list', data: 'emp:list:0' }],
        ],
      },
      dialog: null,
    });
  });

  it.each<[string, () => void, string]>([
    [
      'hidden',
      () => gitlabService.hasVisibleActivity.mockResolvedValue(false),
      locale.employeeAdd.activityHidden,
    ],
    [
      'unknown',
      () => gitlabService.hasVisibleActivity.mockRejectedValue(new GitLabRetryableError('timeout')),
      locale.employeeAdd.activityUnknown,
    ],
  ])('warns when the GitLab activity is %s', async (_name, arrange, warning) => {
    userService.createWithSource.mockResolvedValue(createEmployee().user);
    arrange();

    const reply = await open(
      button('add:gender:male'),
      dialog('gender', { candidate: CANDIDATE, role: JobRole.DEVELOPER }),
    );

    expect(reply.screen.text.split('\n\n')).toEqual([
      'Employee added: **Ivan \\*Petrov\\***.',
      warning,
      locale.employeeAdd.pending,
    ]);
  });

  it('does not create an employee added in the meantime', async () => {
    userService.findOneBySource.mockResolvedValue(createEmployee().user);

    const reply = await open(
      button('add:gender:male'),
      dialog('gender', { candidate: CANDIDATE, role: JobRole.DEVELOPER }),
    );

    expect(userService.createWithSource).not.toHaveBeenCalled();
    expect(reply.screen.text).toContain('is already an employee');
  });

  it('cancels the dialog', async () => {
    expect(await open(button('add:cancel'), dialog('role', {}))).toEqual({
      screen: {
        text: locale.employeeAdd.cancelled,
        buttons: [[{ text: 'To the list', data: 'emp:list:0' }]],
      },
      dialog: null,
    });
  });

  it.each<[string, BotDialog | null]>([
    ['add:pick:502', dialog('pick', { candidates: [CANDIDATE] })],
    ['add:pick:501', dialog('role', { candidate: CANDIDATE })],
    ['add:role:qa', dialog('gender', { candidate: CANDIDATE })],
    ['add:gender:male', dialog('gender', { candidate: CANDIDATE })],
    ['add:gender:male', null],
    ['add:pick:abc', null],
    ['add:role:boss', null],
    ['add:other', null],
  ])('answers the outdated button %s', async (data, current) => {
    const reply = await open(button(data), current);

    expect(reply).toEqual({ screen: { text: locale.bot.expired } });
    expect(userService.createWithSource).not.toHaveBeenCalled();
  });
});
