import { Injectable } from '@nestjs/common';
import type { Screen } from 'src/common/interfaces/chat-channel.interface';
import { TelegramParseMode } from './telegram.enums';
import { TelegramFormatter } from './telegram.formatter';
import type { TelegramMessageContent } from './telegram.interface';

@Injectable()
export class TelegramRenderer {
  constructor(private readonly telegramFormatter: TelegramFormatter) {}

  render(screen: Screen): TelegramMessageContent {
    const content: TelegramMessageContent = {
      text: this.telegramFormatter.format(screen.text),
      parse_mode: TelegramParseMode.HTML,
      link_preview_options: { is_disabled: true },
    };
    if (screen.buttons?.length) {
      content.reply_markup = {
        inline_keyboard: screen.buttons.map((row) =>
          row.map((button) => ({
            text: button.text,
            callback_data: button.data,
          })),
        ),
      };
    }
    return content;
  }
}
