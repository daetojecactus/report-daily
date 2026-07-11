//форматирует дату в ISO строку (YYYY-MM-DD)
export function formatDateToISO(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

//возвращает дату на N дней раньше/позже
export function shiftDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

//последние N дат (ISO, по возрастанию: от старой к сегодняшней)
export function buildRecentDates(
  days: number,
  from: Date = new Date(),
): string[] {
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    dates.push(formatDateToISO(shiftDate(from, -offset)));
  }
  return dates;
}
