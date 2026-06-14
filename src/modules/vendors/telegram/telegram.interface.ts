export interface TelegramResponse {
  ok: boolean;
  description?: string;
}

export interface TelegramApiResponse<T> extends TelegramResponse {
  result: T;
}

//команда бота для меню
export interface BotCommand {
  command: string;
  description: string;
}

//inline кнопка
export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

//inline клавиатура
export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

//входящий update от telegram webhook
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id?: number;
    from?: { id: number };
    chat?: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    from?: { id: number };
    message?: { chat?: { id: number }; message_id?: number };
    data?: string;
  };
  edited_message?: {
    from?: { id: number };
  };
}
