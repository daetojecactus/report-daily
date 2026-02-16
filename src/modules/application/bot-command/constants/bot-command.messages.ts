export enum BotCommandMessages {
  COMMAND_UNKNOWN = 'Неизвестная команда. /help — список команд.',
  COMMAND_USER_CREATED = 'Пользователь создан',
  COMMAND_USER_UPDATED = 'Пользователь обновлён',
  COMMAND_USER_NOT_FOUND = 'Пользователь не найден',
  COMMAND_INVALID_ARGS = 'Неверные аргументы',
  COMMAND_CREATE_ERROR = 'Ошибка создания',
  COMMAND_UPDATE_ERROR = 'Ошибка обновления',
  COMMAND_NO_USERS = 'Пользователей нет',

  START_WELCOME = 'Привет! Ты подключен к Report Daily Bot. Каждый день в установленное время ты будешь получать отчёт о твоей работе в git.',

  SELECT_USER_BLOCK = 'Выберите пользователя для блокировки:',
  SELECT_USER_UNBLOCK = 'Выберите пользователя для разблокировки:',
  SELECT_USER_INFO = 'Выберите пользователя:',
  SELECT_USER_REPORT = 'Выберите пользователя для отчёта:',
  SELECT_USER_UPDATE = 'Выберите пользователя для обновления:',
  SELECT_FIELD = 'Выберите поле для обновления',
  SELECT_ROLE = 'Выберите роль',
  SELECT_STATUS = 'Выберите статус',
  SELECT_HOUR = 'Выберите час отчёта',
  SELECT_AI = 'AI',

  PARSE_ERROR = 'Ошибка парсинга',
  UNKNOWN_ACTION = 'Неизвестное действие',
  UNKNOWN_FIELD = 'Неизвестное поле',

  REPORT_GENERATING = 'Генерирую отчёт',
  REPORT_SENT = 'Отчёт отправлен',
  REPORT_ERROR = 'Ошибка',

  LABEL_ROLE = 'Роль',
  LABEL_STATUS = 'Статус',
  LABEL_REPORT_HOUR = 'Час отчёта',
  LABEL_AI = 'AI',
  LABEL_ENABLE = 'Включить',
  LABEL_DISABLE = 'Выключить',

  USER_BLOCKED = 'заблокирован',
  USER_UNBLOCKED = 'разблокирован',
}
