import { Injectable } from '@nestjs/common';
import { TelegramClient } from './telegram.client';
import type { TelegramResponse, ParseMode } from './telegram.types';

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
    const response = await fetch(
      `${this.telegramClient.getBaseUrl()}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
        }),
      },
    );

    return (await response.json()) as TelegramResponse;
  }
}
