export interface TelegramResponse {
  ok: boolean;
  description?: string;
}

export type ParseMode = 'HTML' | 'Markdown';

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
