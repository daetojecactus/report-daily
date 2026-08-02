import { Injectable } from '@nestjs/common';
import { TelegramClient } from './telegram.client';
import { ParseMode } from './telegram.enums';
import {
  TELEGRAM_DEFAULT_POLL_TIMEOUT,
  TELEGRAM_ERROR_BODY_LIMIT,
  TELEGRAM_REQUEST_TIMEOUT_MS,
} from './constants/telegram.constants';
import type {
  TelegramResponse,
  TelegramApiResponse,
  BotCommand,
  TelegramUpdate,
  InlineKeyboardMarkup,
} from './telegram.interface';

@Injectable()
export class TelegramRepository {
  constructor(private readonly telegramClient: TelegramClient) {}

  //отправка в дефолтный chatId из env
  async sendMessage(
    text: string,
    parseMode: ParseMode = ParseMode.HTML,
  ): Promise<TelegramResponse> {
    return this.sendMessageTo(this.telegramClient.getChatId(), text, parseMode);
  }

  //отправка в произвольный chatId
  async sendMessageTo(
    chatId: number | string,
    text: string,
    parseMode: ParseMode = ParseMode.HTML,
  ): Promise<TelegramResponse> {
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    });
  }

  //отправка с inline клавиатурой
  async sendMessageWithKeyboard(
    chatId: number | string,
    text: string,
    keyboard: InlineKeyboardMarkup,
    parseMode: ParseMode = ParseMode.HTML,
  ): Promise<TelegramResponse> {
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      reply_markup: keyboard,
    });
  }

  //ответ на callback query (убирает часики загрузки)
  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<TelegramResponse> {
    return this.callApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    });
  }

  //редактирование сообщения
  async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    parseMode: ParseMode = ParseMode.HTML,
    keyboard?: InlineKeyboardMarkup,
  ): Promise<TelegramResponse> {
    return this.callApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: parseMode,
      ...(keyboard ? { reply_markup: keyboard } : {}),
    });
  }

  //устанавливает команды бота для конкретного чата (scope: chat)
  async setMyCommandsForChat(
    chatId: number | string,
    commands: BotCommand[],
  ): Promise<TelegramResponse> {
    return this.callApi('setMyCommands', {
      commands,
      scope: { type: 'chat', chat_id: chatId },
    });
  }

  //удаляет команды бота для всех (default scope)
  async deleteMyCommands(): Promise<TelegramResponse> {
    return this.callApi('deleteMyCommands', {});
  }

  //удаляет webhook (нужно для режима long polling)
  async deleteWebhook(dropPendingUpdates = false): Promise<TelegramResponse> {
    return this.callApi('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });
  }

  //получает обновления через long polling
  //таймаут запроса должен превышать таймаут удержания соединения телегой, иначе оборвём сами себя
  async getUpdates(params: {
    offset?: number;
    timeout?: number;
  }): Promise<TelegramApiResponse<TelegramUpdate[]>> {
    const { offset, timeout = TELEGRAM_DEFAULT_POLL_TIMEOUT } = params;

    return this.callApi<TelegramUpdate[]>(
      'getUpdates',
      { timeout, ...(offset ? { offset } : {}) },
      timeout * 1000 + TELEGRAM_REQUEST_TIMEOUT_MS,
    );
  }

  //общий метод вызова Telegram Bot API
  private async callApi<T = boolean>(
    method: string,
    body: Record<string, unknown>,
    timeoutMs = TELEGRAM_REQUEST_TIMEOUT_MS,
  ): Promise<TelegramApiResponse<T>> {
    const response = await fetch(
      `${this.telegramClient.getBaseUrl()}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    //на 5xx и при заглушках прокси телега отвечает не json — читаем как текст,
    //иначе response.json() падает с невнятной ошибкой парсинга
    const raw = await response.text();

    try {
      return JSON.parse(raw) as TelegramApiResponse<T>;
    } catch {
      return {
        ok: false,
        description: `HTTP ${response.status}: ${raw.slice(0, TELEGRAM_ERROR_BODY_LIMIT)}`,
      } as TelegramApiResponse<T>;
    }
  }
}
