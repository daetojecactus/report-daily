//форматирует дату в ISO строку (YYYY-MM-DD)
export function formatDateToISO(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]!;
}

//возвращает дату на N дней раньше/позже
export function shiftDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
