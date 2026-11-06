import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import { ChatUnreachableError } from 'src/common/errors/chat-unreachable.error';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import type {
  ChatCommand,
  ChatEvent,
  ChatInput,
  Screen,
} from 'src/common/interfaces/chat-channel.interface';
import { TelegramRejectedError, TelegramRetryableError } from '../telegram.error';
import { TelegramFormatter } from '../telegram.formatter';
import type {
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
  TelegramUser,
} from '../telegram.interface';
import { TelegramRenderer } from '../telegram.renderer';
import type { TelegramRepository } from '../telegram.repository';
import { TelegramService } from '../telegram.service';

const USER_ID = 300_000_001;
const CHAT_ID = '300000001';
const GROUP_CHAT_ID = -300_000_002;
const MESSAGE_ID = 300_000_003;
const UPDATE_ID = 300_000_004;
const CALLBACK_ID = 'callback-300000001';

const SCREEN: Screen = {
  text: '**Menu** for <you> & me',
  buttons: [
    [
      { text: 'Yes', data: 'menu:yes' },
      { text: 'No', data: 'menu:no' },
    ],
    [{ text: 'Back', data: 'menu:back' }],
  ],
};

const RENDERED_SCREEN = {
  text: '<b>Menu</b> for &lt;you&gt; &amp; me',
  parse_mode: 'HTML',
  link_preview_options: { is_disabled: true },
  reply_markup: {
    inline_keyboard: [
      [
        { text: 'Yes', callback_data: 'menu:yes' },
        { text: 'No', callback_data: 'menu:no' },
      ],
      [{ text: 'Back', callback_data: 'menu:back' }],
    ],
  },
};

const COMMANDS: ChatCommand[] = [
  { command: 'start', description: 'Start' },
  { command: 'help', description: 'Help' },
];

const NOT_MODIFIED_DESCRIPTION = [
  'Bad Request: message is not modified:',
  'specified new message content and reply markup are exactly the same',
  'as a current content and reply markup of the message',
].join(' ');

const QUERY_TOO_OLD_DESCRIPTION = [
  'Bad Request: query is too old and response timeout expired',
  'or query ID is invalid',
].join(' ');

const BLOCKED_DESCRIPTION = 'Forbidden: bot was blocked by the user';

function rejected(code: number, description: string) {
  return new TelegramRejectedError(`Telegram API error: ${code} ${description}`, code, description);
}

const RETRYABLE_ERROR = new TelegramRetryableError('Telegram API error: 429 Too Many Requests', 3);

const UNAUTHORIZED_ERROR = rejected(401, 'Unauthorized');

const UNKNOWN_ERROR = new Error('Unexpected failure');

function sender(values: Partial<TelegramUser> = {}): TelegramUser {
  return {
    id: USER_ID,
    is_bot: false,
    first_name: 'Test',
    language_code: 'ru',
    ...values,
  };
}

function messageUpdate(values: Partial<TelegramMessage> = {}): TelegramUpdate {
  return {
    update_id: UPDATE_ID,
    message: {
      message_id: MESSAGE_ID,
      from: sender(),
      chat: { id: USER_ID, type: 'private' },
      ...values,
    },
  };
}

function commandUpdate(text: string) {
  const [command] = text.split(' ');
  return messageUpdate({
    text,
    entities: [{ type: 'bot_command', offset: 0, length: command.length }],
  });
}

function buttonUpdate(values: Partial<TelegramCallbackQuery> = {}): TelegramUpdate {
  return {
    update_id: UPDATE_ID,
    callback_query: {
      id: CALLBACK_ID,
      from: sender(),
      message: {
        message_id: MESSAGE_ID,
        chat: { id: USER_ID, type: 'private' },
      },
      data: 'menu:open',
      ...values,
    },
  };
}

function chatEvent(input: ChatInput): ChatEvent {
  return {
    channel: Channel.TELEGRAM,
    userId: '300000001',
    chatId: '300000001',
    languageCode: 'ru',
    input,
  };
}

function sentMessage(messageId: number): TelegramMessage {
  return { message_id: messageId, chat: { id: USER_ID, type: 'private' } };
}

describe('TelegramService', () => {
  let repository: {
    getUpdates: Mock<TelegramRepository['getUpdates']>;
    deleteWebhook: Mock<TelegramRepository['deleteWebhook']>;
    sendMessage: Mock<TelegramRepository['sendMessage']>;
    editMessageText: Mock<TelegramRepository['editMessageText']>;
    answerCallbackQuery: Mock<TelegramRepository['answerCallbackQuery']>;
    setMyCommands: Mock<TelegramRepository['setMyCommands']>;
  };
  let service: TelegramService;

  beforeEach(() => {
    repository = {
      getUpdates: vi.fn(),
      deleteWebhook: vi.fn(),
      sendMessage: vi.fn(),
      editMessageText: vi.fn(),
      answerCallbackQuery: vi.fn(),
      setMyCommands: vi.fn(),
    };
    service = new TelegramService(
      repository as unknown as TelegramRepository,
      new TelegramRenderer(new TelegramFormatter()),
    );
  });

  it.each([
    ['123456789', true],
    ['1', true],
    ['0123', false],
    ['-100123', false],
    ['@anna', false],
    ['12345678901234567', false],
  ])('checks that %s is a Telegram user id', (value, isUserId) => {
    expect(service.isUserId(value)).toBe(isUserId);
  });

  describe('toChatEvent', () => {
    it('maps a private command', () => {
      expect(service.toChatEvent(commandUpdate('/start'))).toEqual(
        chatEvent({ type: ChatInputType.COMMAND, command: 'start' }),
      );
    });

    it('maps a command with a bot mention and arguments', () => {
      expect(service.toChatEvent(commandUpdate('/Help@SomeBot extra'))).toEqual(
        chatEvent({ type: ChatInputType.COMMAND, command: 'help' }),
      );
    });

    it('maps plain text', () => {
      expect(service.toChatEvent(messageUpdate({ text: 'Ivan Petrov' }))).toEqual(
        chatEvent({ type: ChatInputType.TEXT, text: 'Ivan Petrov' }),
      );
    });

    it('maps a command after other text as text', () => {
      const update = messageUpdate({
        text: 'see /help',
        entities: [{ type: 'bot_command', offset: 4, length: 5 }],
      });

      expect(service.toChatEvent(update)).toEqual(
        chatEvent({ type: ChatInputType.TEXT, text: 'see /help' }),
      );
    });

    it('maps a message without text as unsupported', () => {
      expect(service.toChatEvent(messageUpdate())).toEqual(
        chatEvent({ type: ChatInputType.UNSUPPORTED }),
      );
    });

    it('maps a picked user', () => {
      expect(
        service.toChatEvent(
          messageUpdate({
            users_shared: { request_id: 1, users: [{ user_id: 300_000_099 }] },
          }),
        ),
      ).toEqual(
        chatEvent({
          type: ChatInputType.PICKED_USER,
          externalId: '300000099',
        }),
      );
    });

    it('maps a button press', () => {
      expect(service.toChatEvent(buttonUpdate())).toEqual(
        chatEvent({
          type: ChatInputType.BUTTON,
          data: 'menu:open',
          messageId: '300000003',
          callbackId: CALLBACK_ID,
        }),
      );
    });

    it('maps a missing language code to null', () => {
      const from = sender({ language_code: undefined });

      expect(service.toChatEvent(messageUpdate({ text: 'hi', from }))).toMatchObject({
        languageCode: null,
      });
      expect(service.toChatEvent(buttonUpdate({ from }))).toMatchObject({
        languageCode: null,
      });
    });

    it('takes the user from the sender and the chat from the message', () => {
      const from = sender({ id: 300_000_005 });
      const chat = { id: 300_000_006, type: 'private' };
      const ids = { userId: '300000005', chatId: '300000006' };

      expect(service.toChatEvent(messageUpdate({ text: 'hi', from, chat }))).toMatchObject(ids);
      expect(
        service.toChatEvent(buttonUpdate({ from, message: { message_id: MESSAGE_ID, chat } })),
      ).toMatchObject(ids);
    });

    it.each([
      {
        name: 'a group message',
        update: messageUpdate({
          text: 'hi',
          chat: { id: GROUP_CHAT_ID, type: 'group' },
        }),
      },
      {
        name: 'a message from a bot',
        update: messageUpdate({ text: 'hi', from: sender({ is_bot: true }) }),
      },
      {
        name: 'a message without a sender',
        update: messageUpdate({ text: 'hi', from: undefined }),
      },
      {
        name: 'a button without data',
        update: buttonUpdate({ data: undefined }),
      },
      {
        name: 'a button without a message',
        update: buttonUpdate({ message: undefined }),
      },
      {
        name: 'a button in a group',
        update: buttonUpdate({
          message: {
            message_id: MESSAGE_ID,
            chat: { id: GROUP_CHAT_ID, type: 'supergroup' },
          },
        }),
      },
      {
        name: 'a button from a bot',
        update: buttonUpdate({ from: sender({ is_bot: true }) }),
      },
      { name: 'another update type', update: { update_id: UPDATE_ID } },
    ])('ignores $name', ({ update }) => {
      expect(service.toChatEvent(update)).toBeNull();
    });
  });

  describe('sendScreen', () => {
    it('sends an HTML message with a keyboard and returns its id', async () => {
      repository.sendMessage.mockResolvedValueOnce(sentMessage(300_000_007));

      await expect(service.sendScreen(CHAT_ID, SCREEN)).resolves.toBe('300000007');
      expect(repository.sendMessage).toHaveBeenCalledExactlyOnceWith(CHAT_ID, RENDERED_SCREEN);
    });

    it.each([
      { name: 'without buttons', buttons: undefined },
      { name: 'with empty buttons', buttons: [] },
    ])('removes a leftover reply keyboard $name', async ({ buttons }) => {
      repository.sendMessage.mockResolvedValueOnce(sentMessage(300_000_007));

      await service.sendScreen(CHAT_ID, { text: 'Hi', buttons });

      expect(repository.sendMessage).toHaveBeenCalledExactlyOnceWith(CHAT_ID, {
        text: 'Hi',
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: { remove_keyboard: true },
      });
    });

    it('sends a user picker as a one-time reply keyboard', async () => {
      repository.sendMessage.mockResolvedValueOnce(sentMessage(300_000_007));

      await service.sendScreen(CHAT_ID, {
        text: 'Pick',
        userPicker: { text: 'Choose' },
      });

      expect(repository.sendMessage).toHaveBeenCalledExactlyOnceWith(CHAT_ID, {
        text: 'Pick',
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: {
          keyboard: [
            [
              {
                text: 'Choose',
                request_users: { request_id: 1, user_is_bot: false },
              },
            ],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    });

    it('throws ChatUnreachableError when the bot is blocked', async () => {
      repository.sendMessage.mockRejectedValueOnce(rejected(403, BLOCKED_DESCRIPTION));

      await expect(service.sendScreen(CHAT_ID, SCREEN)).rejects.toThrow(ChatUnreachableError);
    });

    it.each([
      {
        name: 'a bad request',
        error: rejected(400, "Bad Request: can't parse entities"),
      },
      { name: 'a retryable error', error: RETRYABLE_ERROR },
      { name: 'an unknown error', error: UNKNOWN_ERROR },
    ])('propagates $name', async ({ error }) => {
      repository.sendMessage.mockRejectedValueOnce(error);

      await expect(service.sendScreen(CHAT_ID, SCREEN)).rejects.toBe(error);
    });
  });

  describe('editScreen', () => {
    it('sends a user picker as a new message', async () => {
      repository.sendMessage.mockResolvedValueOnce(sentMessage(300_000_007));

      await service.editScreen(CHAT_ID, '300000003', {
        text: 'Pick',
        userPicker: { text: 'Choose' },
      });

      expect(repository.sendMessage).toHaveBeenCalledOnce();
      expect(repository.editMessageText).not.toHaveBeenCalled();
    });

    it('edits the message by its numeric id', async () => {
      repository.editMessageText.mockResolvedValueOnce();

      await expect(service.editScreen(CHAT_ID, '300000003', SCREEN)).resolves.toBeUndefined();
      expect(repository.editMessageText).toHaveBeenCalledExactlyOnceWith(
        CHAT_ID,
        300_000_003,
        RENDERED_SCREEN,
      );
    });

    it('ignores an unchanged message', async () => {
      repository.editMessageText.mockRejectedValueOnce(rejected(400, NOT_MODIFIED_DESCRIPTION));

      await expect(service.editScreen(CHAT_ID, '300000003', SCREEN)).resolves.toBeUndefined();
      expect(repository.sendMessage).not.toHaveBeenCalled();
    });

    it('sends a new message when the message cannot be edited', async () => {
      repository.editMessageText.mockRejectedValueOnce(
        rejected(400, 'Bad Request: message to edit not found'),
      );
      repository.sendMessage.mockResolvedValueOnce(sentMessage(300_000_008));

      await expect(service.editScreen(CHAT_ID, '300000003', SCREEN)).resolves.toBeUndefined();
      expect(repository.sendMessage).toHaveBeenCalledExactlyOnceWith(CHAT_ID, RENDERED_SCREEN);
    });

    it('throws ChatUnreachableError when the bot is blocked', async () => {
      repository.editMessageText.mockRejectedValueOnce(rejected(403, BLOCKED_DESCRIPTION));

      await expect(service.editScreen(CHAT_ID, '300000003', SCREEN)).rejects.toThrow(
        ChatUnreachableError,
      );
      expect(repository.sendMessage).not.toHaveBeenCalled();
    });

    it('throws ChatUnreachableError when the fallback is blocked', async () => {
      repository.editMessageText.mockRejectedValueOnce(
        rejected(400, "Bad Request: message can't be edited"),
      );
      repository.sendMessage.mockRejectedValueOnce(rejected(403, BLOCKED_DESCRIPTION));

      await expect(service.editScreen(CHAT_ID, '300000003', SCREEN)).rejects.toThrow(
        ChatUnreachableError,
      );
    });

    it.each([
      { name: 'a retryable error', error: RETRYABLE_ERROR },
      { name: 'a rejected error with another code', error: UNAUTHORIZED_ERROR },
      { name: 'an unknown error', error: UNKNOWN_ERROR },
    ])('propagates $name without sending', async ({ error }) => {
      repository.editMessageText.mockRejectedValueOnce(error);

      await expect(service.editScreen(CHAT_ID, '300000003', SCREEN)).rejects.toBe(error);
      expect(repository.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('answerButton', () => {
    it('answers the callback query', async () => {
      repository.answerCallbackQuery.mockResolvedValueOnce();

      await service.answerButton(CALLBACK_ID);

      expect(repository.answerCallbackQuery).toHaveBeenCalledExactlyOnceWith(CALLBACK_ID);
    });

    it('ignores a bad request', async () => {
      repository.answerCallbackQuery.mockRejectedValueOnce(
        rejected(400, QUERY_TOO_OLD_DESCRIPTION),
      );

      await expect(service.answerButton(CALLBACK_ID)).resolves.toBeUndefined();
    });

    it.each([
      { name: 'a retryable error', error: RETRYABLE_ERROR },
      { name: 'a forbidden error', error: rejected(403, BLOCKED_DESCRIPTION) },
      { name: 'a rejected error with another code', error: UNAUTHORIZED_ERROR },
      { name: 'an unknown error', error: UNKNOWN_ERROR },
    ])('rethrows $name', async ({ error }) => {
      repository.answerCallbackQuery.mockRejectedValueOnce(error);

      await expect(service.answerButton(CALLBACK_ID)).rejects.toBe(error);
    });
  });

  describe('commands', () => {
    beforeEach(() => {
      repository.setMyCommands.mockResolvedValue();
    });

    it('sets default commands for private chats in a language', async () => {
      await service.setDefaultCommands(COMMANDS, Language.RU);

      expect(repository.setMyCommands).toHaveBeenCalledExactlyOnceWith(
        COMMANDS,
        { type: 'all_private_chats' },
        'ru',
      );
    });

    it('sets default commands without a language code', async () => {
      await service.setDefaultCommands(COMMANDS, null);

      expect(repository.setMyCommands).toHaveBeenCalledExactlyOnceWith(
        COMMANDS,
        { type: 'all_private_chats' },
        null,
      );
    });

    it('sets commands for one chat', async () => {
      await service.setChatCommands(CHAT_ID, COMMANDS);

      expect(repository.setMyCommands).toHaveBeenCalledExactlyOnceWith(
        COMMANDS,
        { type: 'chat', chat_id: CHAT_ID },
        null,
      );
    });
  });

  describe('updates', () => {
    it('reads updates from the offset', async () => {
      const updates = [commandUpdate('/start'), buttonUpdate()];
      const { signal } = new AbortController();
      repository.getUpdates.mockResolvedValueOnce(updates);

      await expect(service.getUpdates(300_000_009, signal)).resolves.toBe(updates);
      expect(repository.getUpdates).toHaveBeenCalledExactlyOnceWith(300_000_009, signal);
    });

    it('deletes the webhook', async () => {
      repository.deleteWebhook.mockResolvedValueOnce();

      await service.deleteWebhook();

      expect(repository.deleteWebhook).toHaveBeenCalledOnce();
    });
  });
});
