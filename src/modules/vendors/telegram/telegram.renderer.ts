import { Injectable } from '@nestjs/common';
import type {
  Screen,
  ScreenButton,
  ScreenUserPicker,
} from 'src/common/interfaces/chat-channel.interface';
import { TELEGRAM_USER_PICKER_REQUEST_ID } from './constants/telegram.constants';
import { TelegramParseMode } from './telegram.enums';
import { TelegramFormatter } from './telegram.formatter';
import type {
  TelegramInlineKeyboardMarkup,
  TelegramMessageContent,
  TelegramReplyKeyboardMarkup,
} from './telegram.interface';

@Injectable()
export class TelegramRenderer {
  constructor(private readonly telegramFormatter: TelegramFormatter) {}

  renderMessages(screen: Screen): TelegramMessageContent[] {
    const parts = this.renderParts(screen);
    const last = parts[parts.length - 1];
    if (screen.userPicker) {
      last.reply_markup = this.toUserPicker(screen.userPicker);
    } else if (screen.buttons?.length) {
      last.reply_markup = this.toInlineKeyboard(screen.buttons);
    } else {
      last.reply_markup = { remove_keyboard: true };
    }
    return parts;
  }

  renderEdit(screen: Screen): TelegramMessageContent | null {
    const parts = this.renderParts(screen);
    if (parts.length > 1) {
      return null;
    }
    const [content] = parts;
    if (screen.buttons?.length) {
      content.reply_markup = this.toInlineKeyboard(screen.buttons);
    }
    return content;
  }

  private renderParts(screen: Screen): TelegramMessageContent[] {
    return this.telegramFormatter.split(screen.text).map((part) => ({
      text: this.telegramFormatter.format(part),
      parse_mode: TelegramParseMode.HTML,
      link_preview_options: { is_disabled: true },
    }));
  }

  private toInlineKeyboard(buttons: ScreenButton[][]): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: buttons.map((row) =>
        row.map((button) => ({
          text: button.text,
          callback_data: button.data,
        })),
      ),
    };
  }

  private toUserPicker(picker: ScreenUserPicker): TelegramReplyKeyboardMarkup {
    return {
      keyboard: [
        [
          {
            text: picker.text,
            request_users: {
              request_id: TELEGRAM_USER_PICKER_REQUEST_ID,
              user_is_bot: false,
            },
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  }
}
