/**
 * Сообщения ошибок авторизации
 * Возвращаются пользователю при проблемах с доступом
 */
export enum AuthMessages {
  /** Пользователь не зарегистрирован или нет доступа */
  AUTH_ACCESS_DENIED = 'Access denied',

  /** Некорректный Telegram ID (null, undefined, <= 0) */
  AUTH_INVALID_TELEGRAM_ID = 'Invalid telegram id',
}
