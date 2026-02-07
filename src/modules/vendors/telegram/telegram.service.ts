import { Injectable } from "@nestjs/common";
import { TelegramClient } from "./telegram.client";
import { TelegramRepository } from "./telegram.repository";
import { ParseMode } from "./telegram.types";

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
      throw new Error("Telegram not configured");
    }

    const result = await this.telegramRepository.sendMessage(text, parseMode);

    if (!result.ok) {
      throw new Error(`Telegram API: ${result.description || "Unknown error"}`);
    }
  }
}
