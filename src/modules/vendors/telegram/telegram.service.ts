import { Injectable } from '@nestjs/common';
import { TELEGRAM_USER_ID_PATTERN } from 'src/common/constants/telegram.constants';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import { ChatUnreachableError } from 'src/common/errors/chat-unreachable.error';
import type {
  ChatChannel,
  ChatCommand,
  ChatEvent,
  ChatInput,
  Screen,
} from 'src/common/interfaces/chat-channel.interface';
import {
  TELEGRAM_BAD_REQUEST,
  TELEGRAM_BOT_MENTION_SEPARATOR,
  TELEGRAM_COMMAND_ENTITY,
  TELEGRAM_COMMAND_PREFIX,
  TELEGRAM_FORBIDDEN,
  TELEGRAM_NOT_MODIFIED_DESCRIPTION,
  TELEGRAM_PRIVATE_CHAT,
} from './constants/telegram.constants';
import { TelegramScopeType } from './telegram.enums';
import { TelegramRejectedError } from './telegram.error';
import type {
  TelegramCallbackQuery,
  TelegramChat,
  TelegramMessage,
  TelegramUpdate,
  TelegramUser,
} from './telegram.interface';
import { TelegramRenderer } from './telegram.renderer';
import { TelegramRepository } from './telegram.repository';

@Injectable()
export class TelegramService implements ChatChannel {
  readonly channel = Channel.TELEGRAM;

  constructor(
    private readonly telegramRepository: TelegramRepository,
    private readonly telegramRenderer: TelegramRenderer,
  ) {}

  isUserId(value: string) {
    return TELEGRAM_USER_ID_PATTERN.test(value);
  }

  getUpdates(offset: number, signal: AbortSignal) {
    return this.telegramRepository.getUpdates(offset, signal);
  }

  deleteWebhook() {
    return this.telegramRepository.deleteWebhook();
  }

  toChatEvent(update: TelegramUpdate): ChatEvent | null {
    if (update.callback_query) {
      return this.fromCallbackQuery(update.callback_query);
    }
    if (update.message) {
      return this.fromMessage(update.message);
    }
    return null;
  }

  async sendScreen(chatId: string, screen: Screen) {
    const message = await this.reachChat(() =>
      this.telegramRepository.sendMessage(chatId, this.telegramRenderer.renderMessage(screen)),
    );
    return String(message.message_id);
  }

  async editScreen(chatId: string, messageId: string, screen: Screen) {
    if (screen.userPicker) {
      await this.sendScreen(chatId, screen);
      return;
    }
    try {
      await this.reachChat(() =>
        this.telegramRepository.editMessageText(
          chatId,
          Number(messageId),
          this.telegramRenderer.renderEdit(screen),
        ),
      );
    } catch (error) {
      if (!this.isBadRequest(error)) {
        throw error;
      }
      if (error.description.includes(TELEGRAM_NOT_MODIFIED_DESCRIPTION)) {
        return;
      }
      await this.sendScreen(chatId, screen);
    }
  }

  async answerButton(callbackId: string) {
    try {
      await this.telegramRepository.answerCallbackQuery(callbackId);
    } catch (error) {
      if (!this.isBadRequest(error)) {
        throw error;
      }
    }
  }

  async setDefaultCommands(commands: ChatCommand[], languageCode: string | null) {
    await this.telegramRepository.setMyCommands(
      commands,
      { type: TelegramScopeType.ALL_PRIVATE_CHATS },
      languageCode,
    );
  }

  async setChatCommands(chatId: string, commands: ChatCommand[]) {
    await this.telegramRepository.setMyCommands(
      commands,
      { type: TelegramScopeType.CHAT, chat_id: chatId },
      null,
    );
  }

  private async reachChat<T>(call: () => Promise<T>) {
    try {
      return await call();
    } catch (error) {
      if (error instanceof TelegramRejectedError && error.code === TELEGRAM_FORBIDDEN) {
        throw new ChatUnreachableError(error.message);
      }
      throw error;
    }
  }

  private isBadRequest(error: unknown): error is TelegramRejectedError {
    return error instanceof TelegramRejectedError && error.code === TELEGRAM_BAD_REQUEST;
  }

  private fromMessage(message: TelegramMessage) {
    if (!message.from || !this.isPrivate(message.from, message.chat)) {
      return null;
    }
    return this.toEvent(message.from, message.chat, this.toInput(message));
  }

  private fromCallbackQuery(query: TelegramCallbackQuery) {
    const { message, data } = query;
    if (!message || data === undefined || !this.isPrivate(query.from, message.chat)) {
      return null;
    }
    return this.toEvent(query.from, message.chat, {
      type: ChatInputType.BUTTON,
      data,
      messageId: String(message.message_id),
      callbackId: query.id,
    });
  }

  private toInput({ text, entities, users_shared }: TelegramMessage): ChatInput {
    const picked = users_shared?.users[0];
    if (picked) {
      return {
        type: ChatInputType.PICKED_USER,
        externalId: String(picked.user_id),
      };
    }
    const command = entities?.find(
      (entity) => entity.type === TELEGRAM_COMMAND_ENTITY && entity.offset === 0,
    );
    if (text !== undefined && command) {
      return {
        type: ChatInputType.COMMAND,
        command: text
          .slice(TELEGRAM_COMMAND_PREFIX.length, command.length)
          .split(TELEGRAM_BOT_MENTION_SEPARATOR)[0]
          .toLowerCase(),
      };
    }
    if (text !== undefined) {
      return { type: ChatInputType.TEXT, text };
    }
    return { type: ChatInputType.UNSUPPORTED };
  }

  private isPrivate(from: TelegramUser, chat: TelegramChat) {
    return !from.is_bot && chat.type === TELEGRAM_PRIVATE_CHAT;
  }

  private toEvent(from: TelegramUser, chat: TelegramChat, input: ChatInput): ChatEvent {
    return {
      channel: Channel.TELEGRAM,
      userId: String(from.id),
      chatId: String(chat.id),
      languageCode: from.language_code ?? null,
      input,
    };
  }
}
