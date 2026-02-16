export enum BotCallbackAction {
  USER_INFO = 'ui',
  BLOCK_USER = 'bu',
  UNBLOCK_USER = 'ub',
  TEST_REPORT = 'tr',
  UPDATE_USER = 'up',
}

//поля для обновления пользователя
export enum UserField {
  ROLE = 'role',
  STATUS = 'status',
  REPORT_HOUR = 'reportHour',
  USE_AI = 'useAI',
}

//команды бота
export enum BotCommand {
  ADD_USER = '/add_user',
  UPDATE_USER = '/update_user',
  BLOCK_USER = '/block_user',
  UNBLOCK_USER = '/unblock_user',
  USER_INFO = '/user_info',
  TEST_REPORT = '/test_report',
  LIST_USERS = '/list_users',
  HELP = '/help',
  START = '/start',
}

export interface CommandResult {
  text: string;
  keyboard?: InlineKeyboardMarkup;
}

//избегаем циклических зависимостей через локальный интерфейс
export interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}
