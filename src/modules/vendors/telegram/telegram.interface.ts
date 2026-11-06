import type { TelegramParseMode, TelegramScopeType } from './telegram.enums';

export interface TelegramCallOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface TelegramHttpResponse {
  status: number;
  body: string;
}

export interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
}

export interface TelegramUsersShared {
  request_id: number;
  users: { user_id: number }[];
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  entities?: TelegramMessageEntity[];
  users_shared?: TelegramUsersShared;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: { text: string; callback_data: string }[][];
}

export interface TelegramReplyKeyboardMarkup {
  keyboard: {
    text: string;
    request_users: { request_id: number; user_is_bot: boolean };
  }[][];
  resize_keyboard: boolean;
  one_time_keyboard: boolean;
}

export interface TelegramReplyKeyboardRemove {
  remove_keyboard: boolean;
}

export interface TelegramMessageContent {
  text: string;
  parse_mode: TelegramParseMode;
  link_preview_options: { is_disabled: boolean };
  reply_markup?:
    TelegramInlineKeyboardMarkup | TelegramReplyKeyboardMarkup | TelegramReplyKeyboardRemove;
}

export interface TelegramBotCommand {
  command: string;
  description: string;
}

export type TelegramCommandScope =
  { type: TelegramScopeType.ALL_PRIVATE_CHATS } | { type: TelegramScopeType.CHAT; chat_id: string };
