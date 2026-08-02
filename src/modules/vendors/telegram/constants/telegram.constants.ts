//таймаут обычного запроса к bot api; long polling передаёт свой, больший
export const TELEGRAM_REQUEST_TIMEOUT_MS = 30_000;

//сколько символов не-json ответа тащить в текст ошибки
export const TELEGRAM_ERROR_BODY_LIMIT = 200;

//сколько секунд телега держит соединение getUpdates, если вызывающий не задал своё
export const TELEGRAM_DEFAULT_POLL_TIMEOUT = 30;
