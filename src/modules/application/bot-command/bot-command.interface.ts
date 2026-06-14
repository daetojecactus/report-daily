export interface BotCommandSyncResult {
  telegramId: number;
  ok: boolean;
}

export interface CommandResult {
  text: string;
  keyboard?: InlineKeyboardMarkup;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}
