import { Injectable } from '@nestjs/common';
import { TelegramClient } from './telegram.client';
import { TelegramRepository } from './telegram.repository';
import { ParseMode } from './telegram.types';
import { DefaultMessages } from 'src/common/constants/defautl.messages';
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
}
