export interface TelegramResponse {
  ok: boolean;
  description?: string;
}

export interface TelegramApiResponse<T> extends TelegramResponse {
  result: T;
}

export type ParseMode = 'HTML' | 'Markdown';

//команда бота для меню
export interface BotCommand {
  command: string;
  description: string;
}

//входящий update от telegram webhook
export interface TelegramUpdate {
  update_id: number;
  message?: {
    from?: { id: number };
    chat?: { id: number };
    text?: string;
  };
  callback_query?: {
    from?: { id: number };
  };
  edited_message?: {
    from?: { id: number };
  };
}
