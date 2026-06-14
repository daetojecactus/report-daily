import { REPORT_HOURS } from '../constants/bot-command.constants';
import type { InlineKeyboardButton } from '../bot-command.interface';

//одна колонка кнопок: по кнопке на элемент
export function buildColumnKeyboard<T>(
  items: readonly T[],
  buildButton: (item: T) => InlineKeyboardButton,
): InlineKeyboardButton[][] {
  return items.map((item) => [buildButton(item)]);
}

//сетка часов 4 кнопки в ряд из REPORT_HOURS
export function buildHourGridKeyboard(
  buildCallback: (hour: number) => string,
): InlineKeyboardButton[][] {
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < REPORT_HOURS.length; i += 4) {
    rows.push(
      REPORT_HOURS.slice(i, i + 4).map((hour) => ({
        text: `${hour}:00`,
        callback_data: buildCallback(hour),
      })),
    );
  }
  return rows;
}
