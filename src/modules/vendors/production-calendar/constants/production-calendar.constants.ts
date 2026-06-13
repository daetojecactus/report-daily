//таймаут запроса
export const PRODUCTION_CALENDAR_TIMEOUT = 30_000;

//маппинг slug месяца (последний сегмент ссылки) в номер месяца
export const PRODUCTION_CALENDAR_MONTH_SLUG_TO_NUMBER: Record<string, number> =
  {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
