//форматирует дату в ISO строку (YYYY-MM-DD) в локальной таймзоне
//именно локальной: день отчёта везде считается по времени команды, а не по UTC
export function formatDateToISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

//разбирает строку YYYY-MM-DD как локальную полночь
//new Date('2026-08-02') дал бы полночь UTC и съехал бы на сутки в отрицательных таймзонах
export function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

//возвращает дату на N дней раньше/позже
export function shiftDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

//границы локального дня для строки YYYY-MM-DD
export function getLocalDayRange(date: string): { start: Date; end: Date } {
  const start = parseLocalDate(date);
  const end = parseLocalDate(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
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
