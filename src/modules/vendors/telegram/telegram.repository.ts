import { Injectable } from '@nestjs/common';
import { TelegramClient } from './telegram.client';
import type {
  TelegramResponse,
  TelegramApiResponse,
  ParseMode,
  BotCommand,
  TelegramUpdate,
} from './telegram.types';

@Injectable()
export class TelegramRepository {
  constructor(private readonly telegramClient: TelegramClient) {}

  //отправка в дефолтный chatId из env
  async sendMessage(
    text: string,
    parseMode: ParseMode = 'HTML',
  ): Promise<TelegramResponse> {
    return this.sendMessageTo(this.telegramClient.getChatId(), text, parseMode);
  }

  //отправка в произвольный chatId
  async sendMessageTo(
    chatId: number | string,
    text: string,
    parseMode: ParseMode = 'HTML',
  ): Promise<TelegramResponse> {
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
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
  async getUpdates(params: {
    offset?: number;
    timeout?: number;
  }): Promise<TelegramApiResponse<TelegramUpdate[]>> {
    const { offset, timeout = 30 } = params;
    return this.callApi<TelegramUpdate[]>('getUpdates', {
      timeout,
      ...(offset ? { offset } : {}),
    });
  }

  //общий метод вызова Telegram Bot API
  private async callApi<T = boolean>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<TelegramApiResponse<T>> {
    const response = await fetch(
      `${this.telegramClient.getBaseUrl()}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    return (await response.json()) as TelegramApiResponse<T>;
  }
}
