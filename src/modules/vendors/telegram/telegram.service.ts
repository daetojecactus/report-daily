import { Injectable } from '@nestjs/common';
import { TelegramClient } from './telegram.client';
import { TelegramRepository } from './telegram.repository';
import type {
  ParseMode,
  BotCommand,
  TelegramUpdate,
  InlineKeyboardMarkup,
} from './telegram.types';
import { DefaultMessages } from 'src/common/constants/default.messages';
import { TelegramMessages } from './constants/telegram.messages';

@Injectable()
export class TelegramService {
  constructor(
    private readonly telegramClient: TelegramClient,
    private readonly telegramRepository: TelegramRepository,
  ) {}

  isConfigured(): boolean {
    return this.telegramClient.isConfigured();
  }

  async sendMessage(text: string, parseMode?: ParseMode): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(TelegramMessages.TELEGRAM_NOT_CONFIGURED);
    }

    const result = await this.telegramRepository.sendMessage(text, parseMode);

    if (!result.ok) {
      throw new Error(
        `${TelegramMessages.TELEGRAM_API_ERROR}: ${result.description || DefaultMessages.DEFAULT_UNKNOWN_ERROR}`,
      );
    }
  }

  //отправка сообщения конкретному пользователю по chatId
  async sendMessageTo(
    chatId: number | string,
    text: string,
    parseMode?: ParseMode,
  ): Promise<void> {
    const result = await this.telegramRepository.sendMessageTo(
      chatId,
      text,
      parseMode,
    );

    if (!result.ok) {
      throw new Error(
        `${TelegramMessages.TELEGRAM_API_ERROR}: ${result.description || DefaultMessages.DEFAULT_UNKNOWN_ERROR}`,
      );
    }
  }

  //отправка с inline клавиатурой
  async sendMessageWithKeyboard(
    chatId: number | string,
    text: string,
    keyboard: InlineKeyboardMarkup,
    parseMode?: ParseMode,
  ): Promise<void> {
    const result = await this.telegramRepository.sendMessageWithKeyboard(
      chatId,
      text,
      keyboard,
      parseMode,
    );

    if (!result.ok) {
      throw new Error(
        `${TelegramMessages.TELEGRAM_API_ERROR}: ${result.description || DefaultMessages.DEFAULT_UNKNOWN_ERROR}`,
      );
    }
  }

  //ответ на callback query
  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<void> {
    await this.telegramRepository.answerCallbackQuery(callbackQueryId, text);
  }

  //редактирование сообщения
  async editMessage(
    chatId: number | string,
    messageId: number,
    text: string,
    keyboard?: InlineKeyboardMarkup,
    parseMode?: ParseMode,
  ): Promise<void> {
    await this.telegramRepository.editMessageText(
      chatId,
      messageId,
      text,
      parseMode,
      keyboard,
    );
  }

  // устанавливает команды бота для конкретного чата (scope: chat)
  async setCommandsForChat(
    chatId: number | string,
    commands: BotCommand[],
  ): Promise<void> {
    await this.telegramRepository.setMyCommandsForChat(chatId, commands);
  }

  //включает режим long polling (выключает webhook)
  async enableLongPollingMode(): Promise<void> {
    const result = await this.telegramRepository.deleteWebhook(true);

    if (!result.ok) {
      throw new Error(
        `${TelegramMessages.TELEGRAM_API_ERROR}: ${result.description || DefaultMessages.DEFAULT_UNKNOWN_ERROR}`,
      );
    }
  }

  //получает апдейты через long polling
  async getUpdates(params: {
    offset?: number;
    timeout?: number;
  }): Promise<TelegramUpdate[]> {
    const result = await this.telegramRepository.getUpdates(params);

    if (!result.ok) {
      throw new Error(
        `${TelegramMessages.TELEGRAM_API_ERROR}: ${result.description || DefaultMessages.DEFAULT_UNKNOWN_ERROR}`,
      );
    }

    return result.result;
  }
}
