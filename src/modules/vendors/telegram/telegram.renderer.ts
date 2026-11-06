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

  renderMessage(screen: Screen): TelegramMessageContent {
    const content = this.renderText(screen);
    if (screen.userPicker) {
      content.reply_markup = this.toUserPicker(screen.userPicker);
    } else if (screen.buttons?.length) {
      content.reply_markup = this.toInlineKeyboard(screen.buttons);
    } else {
      content.reply_markup = { remove_keyboard: true };
    }
    return content;
  }

  renderEdit(screen: Screen): TelegramMessageContent {
    const content = this.renderText(screen);
    if (screen.buttons?.length) {
      content.reply_markup = this.toInlineKeyboard(screen.buttons);
    }
    return content;
  }

  private renderText(screen: Screen): TelegramMessageContent {
    return {
      text: this.telegramFormatter.format(screen.text),
      parse_mode: TelegramParseMode.HTML,
      link_preview_options: { is_disabled: true },
    };
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
