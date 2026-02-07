import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TelegramClient {
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly baseUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.botToken = config.get("TELEGRAM_BOT_TOKEN") || "";
    this.chatId = config.get("TELEGRAM_ID") || "";
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getChatId(): string {
    return this.chatId;
  }
}
