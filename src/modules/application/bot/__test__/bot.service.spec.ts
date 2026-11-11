import { Injectable, Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotAccess, BotCommand } from 'src/modules/application/bot/core/types/bot.enums';
import { Channel } from 'src/common/channel/types/channel.enums';
import { UserStatus } from 'src/modules/application/user/types/user.enums';
import { ChatUnreachableError } from 'src/common/channel/chat-unreachable.error';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { en } from 'src/modules/application/i18n/locales/en.locale';
import { ru } from 'src/modules/application/i18n/locales/ru.locale';
import type {
  ChatChannel,
  ChatEvent,
  ChatInput,
} from 'src/common/channel/types/chat-channel.interface';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import type { UserWithChannel } from 'src/modules/application/user/types/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { AccessService } from '../core/access.service';
import { BotSection } from '../core/bot.decorator';
import type { BotContext, BotHandler, BotReply } from '../core/types/bot.interface';
import { BotService } from '../bot.service';
import { BOT_CHANNELS } from '../core/constants/bot.constants';
import { BotMessages } from '../core/constants/bot.messages';
import { DialogService } from '../core/dialog.service';
import { CancelHandler } from '../commands/cancel.handler';
import { HelpHandler } from '../commands/help.handler';
import { StartHandler } from '../commands/start.handler';
import { MenuService } from '../core/menu.service';
import { RouterService } from '../core/router.service';
import { createEmployee, EMPLOYEE_ID, OWNER_ID, STRANGER_ID } from './bot.fixture';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';

@Injectable()
@BotSection({ access: BotAccess.ADMIN, namespace: 'test' })
class TestHandler implements BotHandler {
  readonly contexts: BotContext[] = [];

  handle(context: BotContext): BotReply {
    this.contexts.push(context);
    if (context.input.type === ChatInputType.BUTTON && context.input.data === 'test:new') {
      return { screen: { text: 'Rebuilding' }, newMessage: true };
    }
    if (context.input.type === ChatInputType.BUTTON) {
      return {
        screen: {
          text: 'Enter a name',
          buttons: [[{ text: 'Back', data: 'test:back' }]],
        },
        dialog: { namespace: 'test', step: 'name', data: { from: 'button' } },
      };
    }
    return { screen: { text: 'Saved' }, dialog: null };
  }
}

@Injectable()
@BotSection({ access: BotAccess.ADMIN, commands: [BotCommand.HELP] })
class DuplicateHelpHandler implements BotHandler {
  handle(): BotReply {
    return { screen: { text: 'duplicate' } };
  }
}

const DIALOG_KEY = `dialog:telegram:${EMPLOYEE_ID}`;

function event(userId: string, input: ChatInput, languageCode: string | null = 'en'): ChatEvent {
  return {
    channel: Channel.TELEGRAM,
    userId,
    chatId: userId,
    languageCode,
    input,
  };
}

function command(name: string): ChatInput {
  return { type: ChatInputType.COMMAND, command: name };
}

function text(value: string): ChatInput {
  return { type: ChatInputType.TEXT, text: value };
}

function button(data: string): ChatInput {
  return {
    type: ChatInputType.BUTTON,
    data,
    messageId: '7',
    callbackId: 'callback',
  };
}

describe('BotService', () => {
  const store = new Map<string, string>();
  const redisService = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    delete: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
  const userService = {
    findOneByChannel: vi.fn<() => Promise<UserWithChannel | null>>(),
    recordContact: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
  };
  const channelService = { updateReachable: vi.fn(), find: vi.fn().mockResolvedValue([]) };
  const channel = {
    channel: Channel.TELEGRAM,
    sendScreen: vi.fn<ChatChannel['sendScreen']>(),
    editScreen: vi.fn<ChatChannel['editScreen']>(),
    answerButton: vi.fn<ChatChannel['answerButton']>(),
    setDefaultCommands: vi.fn<ChatChannel['setDefaultCommands']>(),
    setChatCommands: vi.fn<ChatChannel['setChatCommands']>(),
    findLanguageCode: vi.fn<ChatChannel['findLanguageCode']>(),
  };

  function createModule(handlers: Provider[]) {
    return Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        BotService,
        AccessService,
        RouterService,
        DialogService,
        MenuService,
        I18nService,
        StartHandler,
        HelpHandler,
        CancelHandler,
        ...handlers,
        { provide: UserService, useValue: userService },
        { provide: ChannelService, useValue: channelService },
        { provide: RedisService, useValue: redisService },
        { provide: ConfigService, useValue: { get: () => [OWNER_ID] } },
        { provide: BOT_CHANNELS, useValue: [channel] },
      ],
    }).compile();
  }

  let moduleRef: TestingModule;
  let botService: BotService;

  beforeAll(async () => {
    Logger.overrideLogger(false);
    moduleRef = await createModule([TestHandler]);
    await moduleRef.init();
    botService = moduleRef.get(BotService);
  });

  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    userService.findOneByChannel.mockResolvedValue(null);
    channel.sendScreen.mockResolvedValue('1');
  });

  afterEach(() => {
    moduleRef.get(TestHandler).contexts.length = 0;
  });

  function asEmployee(values: Parameters<typeof createEmployee>[0] = {}) {
    const found = createEmployee(values);
    userService.findOneByChannel.mockResolvedValue(found);
    return found;
  }

  it('clears the default menus and refreshes the chat menus once after the commands change', async () => {
    await moduleRef.get(MenuService).refresh();

    expect(channel.setDefaultCommands.mock.calls).toEqual([
      [[], Language.RU],
      [[], null],
    ]);
    expect(channel.setChatCommands).toHaveBeenCalledWith(OWNER_ID, expect.any(Array));
    expect(store.get('menu:signature')).toMatch(/^[0-9a-f]{64}$/);

    channel.setChatCommands.mockClear();
    await moduleRef.get(MenuService).refresh();
    expect(channel.setChatCommands).not.toHaveBeenCalled();
  });

  it('stays silent to a person who is not an employee', async () => {
    for (const input of [command('start'), command('help'), text('hello'), button('test:open')]) {
      await botService.handle(event(STRANGER_ID, input, null));
    }
    await botService.replyFailure(event(STRANGER_ID, text('hi')));

    expect(channel.sendScreen).not.toHaveBeenCalled();
    expect(channel.editScreen).not.toHaveBeenCalled();
    expect(channel.answerButton).not.toHaveBeenCalled();
    expect(channel.setChatCommands).not.toHaveBeenCalled();
    expect(channel.findLanguageCode).not.toHaveBeenCalled();
    expect(moduleRef.get(TestHandler).contexts).toEqual([]);
  });

  it('tells a blocked employee their id in their language and shows help without the privacy note', async () => {
    asEmployee({ status: UserStatus.BLOCKED, language: null });

    await botService.handle(event(EMPLOYEE_ID, command('start'), 'ru'));
    await botService.handle(event(EMPLOYEE_ID, command('help')));

    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, {
      text: ru.bot.noAccess('Telegram', EMPLOYEE_ID),
    });
    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, {
      text: [
        en.help.title,
        `/start — ${en.commands.start}`,
        `/help — ${en.commands.help}`,
        `/cancel — ${en.commands.cancel}`,
      ].join('\n'),
    });
  });

  it('removes the menu of a deleted employee and keeps start and help for a blocked one', async () => {
    const { user, channel: chat } = createEmployee({ status: UserStatus.BLOCKED });

    await moduleRef.get(MenuService).syncEmployee(null, [chat]);
    await moduleRef.get(MenuService).syncEmployee(user, [chat]);

    expect(channel.setChatCommands.mock.calls).toEqual([
      [chat.externalId, []],
      [
        chat.externalId,
        [
          { command: 'start', description: en.commands.start },
          { command: 'help', description: en.commands.help },
          { command: 'cancel', description: en.commands.cancel },
        ],
      ],
    ]);
  });

  it('greets an owner and syncs the owner menu', async () => {
    await botService.handle(event(OWNER_ID, command('start')));

    expect(channel.sendScreen).toHaveBeenCalledWith(OWNER_ID, {
      text: en.start.owner,
    });
    expect(channel.setChatCommands).toHaveBeenCalledWith(OWNER_ID, [
      { command: 'start', description: en.commands.start },
      { command: 'help', description: en.commands.help },
      { command: 'cancel', description: en.commands.cancel },
    ]);
  });

  it('greets an employee with an escaped name', async () => {
    const found = asEmployee();

    await botService.handle(event(EMPLOYEE_ID, command('start'), 'ru'));

    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, {
      text: en.start.employee('Ivan \\*Petrov\\*'),
    });
    expect(userService.recordContact).toHaveBeenCalledWith(found, Language.EN);
  });

  it('uses the Telegram language of an employee without one', async () => {
    const found = asEmployee({ language: null });

    await botService.handle(event(EMPLOYEE_ID, command('start'), 'ru'));

    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, {
      text: ru.start.employee('Ivan \\*Petrov\\*'),
    });
    expect(userService.recordContact).toHaveBeenCalledWith(found, Language.RU);
  });

  it('treats a blocked employee as a stranger', async () => {
    asEmployee({ status: UserStatus.BLOCKED });

    await botService.handle(event(EMPLOYEE_ID, command('start')));

    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, {
      text: en.bot.noAccess('Telegram', EMPLOYEE_ID),
    });
    expect(userService.recordContact).not.toHaveBeenCalled();
  });

  it('denies a section above the access level', async () => {
    asEmployee();

    await botService.handle(event(EMPLOYEE_ID, button('test:open')));

    expect(channel.answerButton).toHaveBeenCalledWith('callback');
    expect(channel.editScreen).toHaveBeenCalledWith(EMPLOYEE_ID, '7', {
      text: en.bot.forbidden,
    });
    expect(moduleRef.get(TestHandler).contexts).toEqual([]);
  });

  it('answers a button with a new message when the section asks for it', async () => {
    asEmployee({ isAdmin: true });

    await botService.handle(event(EMPLOYEE_ID, button('test:new')));

    expect(channel.answerButton).toHaveBeenCalledWith('callback');
    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, { text: 'Rebuilding' });
    expect(channel.editScreen).not.toHaveBeenCalled();
  });

  it('passes a picked user to the section of the dialog', async () => {
    asEmployee({ isAdmin: true });
    store.set(DIALOG_KEY, JSON.stringify({ namespace: 'test', step: 'name', data: {} }));

    await botService.handle(
      event(EMPLOYEE_ID, { type: ChatInputType.PICKED_USER, externalId: '42' }),
    );

    const [context] = moduleRef.get(TestHandler).contexts;
    expect(context.input).toEqual({
      type: ChatInputType.PICKED_USER,
      externalId: '42',
    });
  });

  it('runs a dialog of a section the access level opens', async () => {
    asEmployee({ isAdmin: true });

    await botService.handle(event(EMPLOYEE_ID, button('test:open')));
    await botService.handle(event(EMPLOYEE_ID, text('Anna')));

    expect(channel.editScreen).toHaveBeenCalledWith(EMPLOYEE_ID, '7', {
      text: 'Enter a name',
      buttons: [[{ text: 'Back', data: 'test:back' }]],
    });
    const [, second] = moduleRef.get(TestHandler).contexts;
    expect(second.input).toEqual(text('Anna'));
    expect(second.dialog).toEqual({
      namespace: 'test',
      step: 'name',
      data: { from: 'button' },
    });
    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, {
      text: 'Saved',
    });
    expect(store.has(DIALOG_KEY)).toBe(false);
  });

  it('lets an owner open any section', async () => {
    await botService.handle(event(OWNER_ID, button('test:open')));

    expect(moduleRef.get(TestHandler).contexts).toHaveLength(1);
    expect(store.get(`dialog:telegram:${OWNER_ID}`)).toBeDefined();
  });

  it('drops a dialog when another command arrives', async () => {
    asEmployee({ isAdmin: true });
    store.set(DIALOG_KEY, JSON.stringify({ namespace: 'test', step: 'name', data: {} }));

    await botService.handle(event(EMPLOYEE_ID, command('help')));

    expect(store.has(DIALOG_KEY)).toBe(false);
    expect(moduleRef.get(TestHandler).contexts).toEqual([]);
  });

  it('cancels a dialog and reports when there is nothing to cancel', async () => {
    asEmployee();
    store.set(DIALOG_KEY, JSON.stringify({ namespace: 'test', step: 'name', data: {} }));

    await botService.handle(event(EMPLOYEE_ID, command('cancel')));
    await botService.handle(event(EMPLOYEE_ID, command('cancel')));

    expect(channel.sendScreen).toHaveBeenNthCalledWith(1, EMPLOYEE_ID, {
      text: en.cancel.done,
    });
    expect(channel.sendScreen).toHaveBeenNthCalledWith(2, EMPLOYEE_ID, {
      text: en.cancel.nothing,
    });
  });

  it('drops a dialog when the admin access was removed', async () => {
    asEmployee();
    store.set(DIALOG_KEY, JSON.stringify({ namespace: 'test', step: 'name', data: {} }));

    await botService.handle(event(EMPLOYEE_ID, text('Anna')));

    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, {
      text: en.bot.forbidden,
    });
    expect(store.has(DIALOG_KEY)).toBe(false);
  });

  it('ignores a dialog with an unknown shape', async () => {
    asEmployee({ isAdmin: true });
    store.set(DIALOG_KEY, JSON.stringify({ namespace: 'test' }));

    await botService.handle(event(EMPLOYEE_ID, text('Anna')));

    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, {
      text: en.bot.unknownInput,
    });
  });

  it.each<[string, ChatInput, string]>([
    ['an unknown command', command('nope'), en.bot.unknownCommand],
    ['text outside a dialog', text('hello'), en.bot.unknownInput],
    ['unsupported content', { type: ChatInputType.UNSUPPORTED }, en.bot.unknownInput],
    [
      'a picked user outside a dialog',
      { type: ChatInputType.PICKED_USER, externalId: '1' },
      en.bot.unknownInput,
    ],
  ])('explains %s to an employee', async (_name, input, reply) => {
    asEmployee();

    await botService.handle(event(EMPLOYEE_ID, input));

    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, {
      text: reply,
    });
  });

  it.each(['gone:open', 'BAD DATA', `test:${'x'.repeat(64)}`])(
    'answers the outdated button %s',
    async (data) => {
      asEmployee({ isAdmin: true });

      await botService.handle(event(EMPLOYEE_ID, button(data)));

      expect(channel.editScreen).toHaveBeenCalledWith(EMPLOYEE_ID, '7', {
        text: en.bot.expired,
      });
      expect(moduleRef.get(TestHandler).contexts).toEqual([]);
    },
  );

  it('marks the chat of an employee unreachable', async () => {
    asEmployee();
    channel.sendScreen.mockRejectedValue(new ChatUnreachableError('blocked'));

    await botService.handle(event(EMPLOYEE_ID, command('help')));

    expect(channelService.updateReachable).toHaveBeenCalledWith(
      Channel.TELEGRAM,
      EMPLOYEE_ID,
      false,
    );
  });

  it('ignores an unreachable chat of an owner who is not an employee', async () => {
    channel.sendScreen.mockRejectedValue(new ChatUnreachableError('blocked'));

    await botService.handle(event(OWNER_ID, command('help')));

    expect(channelService.updateReachable).not.toHaveBeenCalled();
  });

  it('propagates other channel errors', async () => {
    channel.sendScreen.mockRejectedValue(new Error('network'));

    await expect(botService.handle(event(OWNER_ID, command('help')))).rejects.toThrow('network');
  });

  it('replies with a failure message in the language of the event', async () => {
    await botService.replyFailure(event(OWNER_ID, text('hi'), 'ru'));

    expect(channel.sendScreen).toHaveBeenCalledWith(OWNER_ID, {
      text: ru.bot.error,
    });
  });

  it('replies with a failure message in the language of the employee', async () => {
    asEmployee({ language: Language.RU });

    await botService.replyFailure(event(EMPLOYEE_ID, text('hi'), 'en'));

    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, { text: ru.bot.error });
  });

  it('answers an owner in the language the channel knows from the profile', async () => {
    channel.findLanguageCode.mockResolvedValue('ru-RU');

    await botService.handle(event(OWNER_ID, text('hi'), null));

    expect(channel.findLanguageCode).toHaveBeenCalledWith(OWNER_ID);
    expect(channel.sendScreen).toHaveBeenCalledWith(OWNER_ID, {
      text: ru.bot.unknownInput,
    });
  });

  it('answers a failed button press with a new message', async () => {
    await botService.replyFailure(event(OWNER_ID, button('test:open')));

    expect(channel.answerButton).toHaveBeenCalledWith('callback');
    expect(channel.sendScreen).toHaveBeenCalledWith(OWNER_ID, {
      text: en.bot.error,
    });
    expect(channel.editScreen).not.toHaveBeenCalled();
  });

  it('rejects two sections with the same command', async () => {
    const duplicate = await createModule([DuplicateHelpHandler]);

    await expect(duplicate.init()).rejects.toThrow(BotMessages.DUPLICATE_COMMAND);
  });

  it('sends a screen to a chat and marks the chat unreachable when the bot is blocked', async () => {
    const target = { channel: Channel.TELEGRAM, chatId: EMPLOYEE_ID, externalId: EMPLOYEE_ID };
    await botService.sendTo(target, { text: 'project:\n• Fixed a bug' });
    expect(channel.sendScreen).toHaveBeenCalledWith(EMPLOYEE_ID, {
      text: 'project:\n• Fixed a bug',
    });

    channel.sendScreen.mockRejectedValue(new ChatUnreachableError('blocked'));
    await botService.sendTo(target, { text: 'project:\n• Fixed a bug' });
    expect(channelService.updateReachable).toHaveBeenCalledWith(
      Channel.TELEGRAM,
      EMPLOYEE_ID,
      false,
    );
  });
});
