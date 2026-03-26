import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReportDailyBotEnvs } from '../../config/env';

@Injectable()
export class TelegramClient {
  private readonly baseUrl: string;
  private readonly chatId: string;

  constructor(
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {
    const botToken = this.configService.get('TELEGRAM_BOT_TOKEN');
    this.chatId = this.configService.get('TELEGRAM_ID') ?? '';
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  isConfigured(): boolean {
    return Boolean(this.chatId);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getChatId(): string {
    return this.chatId;
  }
}
