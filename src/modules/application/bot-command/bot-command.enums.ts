export enum BotCallbackAction {
  USER_INFO = 'ui',
  BLOCK_USER = 'bu',
  UNBLOCK_USER = 'ub',
  TEST_REPORT = 'tr',
  UPDATE_USER = 'up',
  ADD_USER_ROLE = 'ar',
  ADD_USER_HOUR = 'ah',
  BROADCAST_CONFIRM = 'bc_ok',
  BROADCAST_CANCEL = 'bc_no',
}

//callback-действия для пользовательских команд (не-админ)
export enum UserCallbackAction {
  TOGGLE_AI = 'u_ai',
  CHANGE_HOUR = 'u_hr',
  SET_LANGUAGE = 'u_la',
}

//шаги визарда добавления пользователя
export enum AddUserStep {
  ADMIN_ID = 'adminId',
  TELEGRAM_ID = 'telegramId',
  ROLE = 'role',
  HOUR = 'hour',
}

//шаги визарда рассылки
export enum BroadcastStep {
  TEXT = 'text',
  CONFIRM = 'confirm',
}

//префиксы callback-данных для обновления пользователя
export enum CallbackDataPrefix {
  UPDATE_FIELD = 'uf',
  UPDATE_VALUE = 'uv',
}

//поля для обновления пользователя
export enum UserField {
  ROLE = 'role',
  STATUS = 'status',
  REPORT_HOUR = 'reportHour',
  USE_AI = 'useAI',
  REPORT_TEMPLATE = 'reportTemplate',
  LANGUAGE = 'language',
}

//команды бота (админ)
export enum BotCommand {
  ADD_USER = '/add_user',
  UPDATE_USER = '/update_user',
  BLOCK_USER = '/block_user',
  UNBLOCK_USER = '/unblock_user',
  USER_INFO = '/user_info',
  SEND_USER_REPORT = '/send_user_report',
  LIST_USERS = '/list_users',
  BROADCAST = '/broadcast',
  HELP = '/help',
  START = '/start',
  //пользовательские команды
  INFO = '/info',
  SEND_REPORT = '/send_report',
  TOGGLE_AI = '/toggle_ai',
  CHANGE_REPORT_HOUR = '/change_report_hour',
  LANGUAGE = '/language',
}
