import { Injectable } from "@nestjs/common";
import { TelegramClient } from "./telegram.client";
import type { TelegramResponse, ParseMode } from "./telegram.types";

@Injectable()
export class TelegramRepository {
  constructor(private readonly telegramClient: TelegramClient) {}

  async sendMessage(
    text: string,
    parseMode: ParseMode = "HTML",
  ): Promise<TelegramResponse> {
    const response = await fetch(
      `${this.telegramClient.getBaseUrl()}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.telegramClient.getChatId(),
          text,
          parse_mode: parseMode,
        }),
      },
    );

    return (await response.json()) as TelegramResponse;
  }
}
