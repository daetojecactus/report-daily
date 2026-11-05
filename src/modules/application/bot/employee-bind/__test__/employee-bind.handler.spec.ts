import { Logger } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatChannel, ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserChannel } from 'src/modules/application/user/channel/channel.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import type { User, UserWithChannel } from 'src/modules/application/user/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { BotDialog } from '../../bot.interface';
import type { MenuService } from '../../menu/menu.service';
import { createEmployee } from '../../__test__/bot.fixture';
import { EmployeeBindHandler } from '../employee-bind.handler';

const locale = new I18nService().getLocale(Language.EN);
const found = createEmployee({ displayName: 'Anna *S*' });
const USER = found.user;
const ID_DIALOG: BotDialog = {
  namespace: 'bind',
  step: 'id',
  data: { userId: USER.id },
};
const CANCEL = { text: 'Cancel', data: `bind:cancel:${USER.id}` };

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

function text(value: string): ChatInput {
  return { type: ChatInputType.TEXT, text: value };
}

describe('EmployeeBindHandler', () => {
  const userService = {
    findById: vi.fn<(id: string) => Promise<User | null>>(),
    findOneByChannel:
      vi.fn<(channel: Channel, externalId: string) => Promise<UserWithChannel | null>>(),
    bindChannel:
      vi.fn<(userId: string, channel: Channel, externalId: string) => Promise<UserChannel>>(),
  };
  const channelService = {
    findByUser: vi.fn<(userId: string) => Promise<UserChannel[]>>(),
  };
  const telegram = {
    channel: Channel.TELEGRAM,
    isUserId: (value: string) => /^\d+$/.test(value),
  };
  const menuService = { syncEmployee: vi.fn() };
  const handler = new EmployeeBindHandler(
    userService as unknown as UserService,
    channelService as unknown as ChannelService,
    menuService as unknown as MenuService,
    [telegram as unknown as ChatChannel],
  );

  function open(input: ChatInput, dialog: BotDialog | null = null) {
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
      dialog,
    });
  }

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    userService.bindChannel.mockResolvedValue(found.channel);
    userService.findById.mockResolvedValue(USER);
    userService.findOneByChannel.mockResolvedValue(null);
    channelService.findByUser.mockResolvedValue([]);
  });

  it('offers to choose the employee in Telegram or to enter the ID', async () => {
    expect(await open(button(`bind:start:${USER.id}`))).toEqual({
      screen: {
        text: locale.employeeBind.prompt('Telegram', 'Anna \\*S\\*'),
        buttons: [[{ text: 'Choose in Telegram', data: `bind:pick:${USER.id}` }], [CANCEL]],
      },
      dialog: ID_DIALOG,
    });
  });

  it('shows the Telegram user picker', async () => {
    expect(await open(button(`bind:pick:${USER.id}`))).toEqual({
      screen: {
        text: locale.employeeBind.pickPrompt,
        userPicker: { text: locale.employeeBind.pickButton },
      },
      dialog: ID_DIALOG,
    });
  });

  it('binds the picked user', async () => {
    const reply = await open(
      { type: ChatInputType.PICKED_USER, externalId: '777000222' },
      ID_DIALOG,
    );

    expect(userService.bindChannel).toHaveBeenCalledWith(USER.id, Channel.TELEGRAM, '777000222');
    expect(reply.dialog).toBeNull();
  });

  it('binds a valid ID and activates the employee', async () => {
    const reply = await open(text(' 777000111 '), ID_DIALOG);

    expect(userService.bindChannel).toHaveBeenCalledWith(USER.id, Channel.TELEGRAM, '777000111');
    expect(menuService.syncEmployee).toHaveBeenCalledWith(USER, [found.channel]);
    expect(reply).toEqual({
      screen: {
        text: ['Telegram bound: **Anna \\*S\\***.', locale.employeeBind.hint].join('\n\n'),
        buttons: [
          [{ text: 'Open the card', data: `emp:card:${USER.id}:0` }],
          [{ text: 'To the list', data: 'emp:list:0' }],
        ],
      },
      dialog: null,
    });
  });

  it('asks again for something that is not an ID', async () => {
    const reply = await open(text('@anna'), ID_DIALOG);

    expect(userService.bindChannel).not.toHaveBeenCalled();
    expect(reply).toEqual({
      screen: {
        text: locale.employeeBind.invalid('Telegram'),
        buttons: [[CANCEL]],
      },
    });
  });

  it('asks again for an ID of another employee', async () => {
    userService.findOneByChannel.mockResolvedValue(createEmployee({ displayName: 'Boris' }));

    const reply = await open(text('777000111'), ID_DIALOG);

    expect(userService.bindChannel).not.toHaveBeenCalled();
    expect(reply.screen.text).toBe(locale.employeeBind.taken('Boris'));
    expect(reply.dialog).toBeUndefined();
  });

  it.each<[string, ChatInput, BotDialog | null]>([
    ['the button', button(`bind:start:${USER.id}`), null],
    ['the ID', text('777000111'), ID_DIALOG],
  ])('refuses %s when the employee already has Telegram', async (_name, input, dialog) => {
    channelService.findByUser.mockResolvedValue([found.channel]);

    expect(await open(input, dialog)).toEqual({
      screen: {
        text: locale.employeeBind.alreadyBound('Telegram'),
        buttons: [[{ text: 'Open the card', data: `emp:card:${USER.id}:0` }]],
      },
      dialog: null,
    });
    expect(userService.bindChannel).not.toHaveBeenCalled();
  });

  it('reports a deleted employee', async () => {
    userService.findById.mockResolvedValue(null);

    expect(await open(button(`bind:start:${USER.id}`))).toEqual({
      screen: {
        text: locale.employees.notFound,
        buttons: [[{ text: 'To the list', data: 'emp:list:0' }]],
      },
      dialog: null,
    });
  });

  it('cancels binding and offers the card', async () => {
    expect(await open(button(`bind:cancel:${USER.id}`), ID_DIALOG)).toEqual({
      screen: {
        text: locale.employeeBind.cancelled,
        buttons: [[{ text: 'Open the card', data: `emp:card:${USER.id}:0` }]],
      },
      dialog: null,
    });
  });

  it('drops a dialog without the employee', async () => {
    expect(await open(text('777000111'), { ...ID_DIALOG, data: {} })).toEqual({
      screen: { text: locale.bot.expired },
      dialog: null,
    });
  });

  it.each(['bind:start:not-a-uuid', 'bind:other:' + USER.id, 'bind:start'])(
    'answers the outdated button %s',
    async (data) => {
      expect((await open(button(data))).screen).toEqual({
        text: locale.bot.expired,
      });
    },
  );
});
