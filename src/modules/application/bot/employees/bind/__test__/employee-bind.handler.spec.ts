import { Logger } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatChannel, ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserChannel } from 'src/modules/application/user/channel/types/channel.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import type { User, UserWithChannel } from 'src/modules/application/user/types/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { BotDialog } from '../../../core/types/bot.interface';
import type { MenuService } from '../../../core/menu.service';
import { createEmployee } from '../../../__test__/bot.fixture';
import { EmployeeBindHandler } from '../employee-bind.handler';

const locale = new I18nService().getLocale(Language.EN);
const texts = locale.employeeBind;
const found = createEmployee({ displayName: 'Anna *S*' });
const USER = found.user;
const NAME = 'Anna \\*S\\*';
const ID_DIALOG: BotDialog = {
  namespace: 'bind',
  step: 'id',
  data: { userId: USER.id, channel: 'telegram' },
};
const SLACK_DIALOG: BotDialog = { ...ID_DIALOG, data: { userId: USER.id, channel: 'slack' } };
const CANCEL = { text: 'Cancel', data: `bind:cancel:${USER.id}:telegram` };
const SLACK_CANCEL = { text: 'Cancel', data: `bind:cancel:${USER.id}:slack` };

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
  const slack = {
    channel: Channel.SLACK,
    isUserId: (value: string) => /^[UW][A-Z0-9]{2,20}$/.test(value),
  };
  const menuService = { syncEmployee: vi.fn() };
  const createHandler = (channels: unknown[]) =>
    new EmployeeBindHandler(
      userService as unknown as UserService,
      channelService as unknown as ChannelService,
      menuService as unknown as MenuService,
      channels as ChatChannel[],
    );
  const handler = createHandler([telegram, slack]);

  function open(input: ChatInput, dialog: BotDialog | null = null, channel = Channel.TELEGRAM) {
    return handler.handle({
      actor: {
        channel,
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
    expect(await open(button(`bind:start:${USER.id}:telegram`))).toEqual({
      screen: {
        text: [texts.prompt('Telegram', NAME), texts.idHint.telegram].join('\n'),
        buttons: [
          [{ text: 'Choose in Telegram', data: `bind:pick:${USER.id}:telegram` }],
          [CANCEL],
        ],
      },
      dialog: ID_DIALOG,
    });
  });

  it('shows the Telegram user picker', async () => {
    expect(await open(button(`bind:pick:${USER.id}:telegram`))).toEqual({
      screen: {
        text: texts.pickPrompt.telegram,
        userPicker: { text: texts.pickButton },
      },
      dialog: ID_DIALOG,
    });
  });

  it('asks for the Slack ID in Telegram, where there is no Slack picker', async () => {
    const reply = {
      screen: {
        text: [texts.promptId('Slack', NAME), texts.idHint.slack].join('\n'),
        buttons: [[SLACK_CANCEL]],
      },
      dialog: SLACK_DIALOG,
    };

    expect(await open(button(`bind:start:${USER.id}:slack`))).toEqual(reply);
    expect(await open(button(`bind:pick:${USER.id}:slack`))).toEqual(reply);
  });

  it('shows the Slack member picker in Slack', async () => {
    expect(await open(button(`bind:pick:${USER.id}:slack`), null, Channel.SLACK)).toEqual({
      screen: {
        text: texts.pickPrompt.slack,
        userPicker: { text: texts.pickButton },
      },
      dialog: SLACK_DIALOG,
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

  it('does not take a member picked in another channel', async () => {
    const reply = await open(
      { type: ChatInputType.PICKED_USER, externalId: '777000222' },
      SLACK_DIALOG,
    );

    expect(userService.bindChannel).not.toHaveBeenCalled();
    expect(reply).toEqual({
      screen: {
        text: `${texts.invalid('Slack')} ${texts.idHint.slack}`,
        buttons: [[SLACK_CANCEL]],
      },
    });
  });

  it('binds a valid ID and activates the employee', async () => {
    const reply = await open(text(' 777000111 '), ID_DIALOG);

    expect(userService.bindChannel).toHaveBeenCalledWith(USER.id, Channel.TELEGRAM, '777000111');
    expect(menuService.syncEmployee).toHaveBeenCalledWith(USER, [found.channel]);
    expect(reply).toEqual({
      screen: {
        text: [`Telegram bound: **${NAME}**.`, texts.hint.telegram].join('\n\n'),
        buttons: [
          [{ text: 'Open the card', data: `emp:card:${USER.id}:0` }],
          [{ text: 'To the list', data: 'emp:list:0' }],
        ],
      },
      dialog: null,
    });
  });

  it('binds a Slack ID entered in Telegram', async () => {
    const reply = await open(text(' U0ANNA01 '), SLACK_DIALOG);

    expect(userService.findOneByChannel).toHaveBeenCalledWith(Channel.SLACK, 'U0ANNA01');
    expect(userService.bindChannel).toHaveBeenCalledWith(USER.id, Channel.SLACK, 'U0ANNA01');
    expect(reply.screen.text).toBe([`Slack bound: **${NAME}**.`, texts.hint.slack].join('\n\n'));
  });

  it.each<[string, string, BotDialog, string]>([
    ['Telegram', '@anna', ID_DIALOG, `${texts.invalid('Telegram')} ${texts.idHint.telegram}`],
    ['Slack', '777000111', SLACK_DIALOG, `${texts.invalid('Slack')} ${texts.idHint.slack}`],
  ])('asks again for something that is not a %s ID', async (_name, value, dialog, invalid) => {
    const reply = await open(text(value), dialog);

    expect(userService.bindChannel).not.toHaveBeenCalled();
    expect(reply.screen.text).toBe(invalid);
    expect(reply.dialog).toBeUndefined();
  });

  it('asks again for an ID of another employee', async () => {
    userService.findOneByChannel.mockResolvedValue(createEmployee({ displayName: 'Boris' }));

    const reply = await open(text('777000111'), ID_DIALOG);

    expect(userService.bindChannel).not.toHaveBeenCalled();
    expect(reply).toEqual({ screen: { text: texts.taken('Boris'), buttons: [[CANCEL]] } });
  });

  it.each<[string, ChatInput, BotDialog | null]>([
    ['the button', button(`bind:start:${USER.id}:telegram`), null],
    ['the ID', text('777000111'), ID_DIALOG],
  ])('refuses %s when the employee already has Telegram', async (_name, input, dialog) => {
    channelService.findByUser.mockResolvedValue([found.channel]);

    expect(await open(input, dialog)).toEqual({
      screen: {
        text: texts.alreadyBound('Telegram'),
        buttons: [[{ text: 'Open the card', data: `emp:card:${USER.id}:0` }]],
      },
      dialog: null,
    });
    expect(userService.bindChannel).not.toHaveBeenCalled();
  });

  it('reports a deleted employee', async () => {
    userService.findById.mockResolvedValue(null);

    expect(await open(button(`bind:start:${USER.id}:telegram`))).toEqual({
      screen: {
        text: locale.employees.notFound,
        buttons: [[{ text: 'To the list', data: 'emp:list:0' }]],
      },
      dialog: null,
    });
  });

  it('cancels binding and offers the card', async () => {
    expect(await open(button(`bind:cancel:${USER.id}:telegram`), ID_DIALOG)).toEqual({
      screen: {
        text: texts.cancelled,
        buttons: [[{ text: 'Open the card', data: `emp:card:${USER.id}:0` }]],
      },
      dialog: null,
    });
  });

  it.each([{}, { userId: USER.id }])(
    'drops a dialog %j without the employee or the channel',
    async (data) => {
      expect(await open(text('777000111'), { ...ID_DIALOG, data })).toEqual({
        screen: { text: locale.bot.expired },
        dialog: null,
      });
    },
  );

  it.each([
    'bind:start:not-a-uuid:telegram',
    `bind:other:${USER.id}:telegram`,
    `bind:start:${USER.id}`,
    `bind:start:${USER.id}:email`,
  ])('answers the outdated button %s', async (data) => {
    expect((await open(button(data))).screen).toEqual({ text: locale.bot.expired });
  });

  it('answers a button of a channel that is no longer configured', async () => {
    const reply = await createHandler([telegram]).handle({
      actor: {
        channel: Channel.TELEGRAM,
        externalId: '1',
        chatId: '1',
        language: Language.EN,
        isOwner: true,
        user: null,
      },
      locale,
      input: button(`bind:start:${USER.id}:slack`),
      dialog: null,
    });

    expect(reply.screen).toEqual({ text: locale.bot.expired });
  });
});
