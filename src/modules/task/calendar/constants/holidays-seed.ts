import type { HolidayCalendarEntry } from '../../../application/holiday-calendar/embedded/holiday-calendar-entry.schema';

//выходные дни (суббота, воскресенье) генерируются автоматически
//здесь только государственные праздники Казахстана

//государственные праздники Казахстана (фиксированные даты)
const KZ_FIXED_HOLIDAYS: HolidayCalendarEntry[] = [
  { month: 1, day: 1 }, //Новый год
  { month: 1, day: 2 }, //Новый год (продолжение)
  { month: 3, day: 8 }, //Международный женский день
  { month: 3, day: 21 }, //Наурыз мейрамы
  { month: 3, day: 22 }, //Наурыз мейрамы
  { month: 3, day: 23 }, //Наурыз мейрамы
  { month: 5, day: 1 }, //Праздник единства народа
  { month: 5, day: 7 }, //День защитника Отечества
  { month: 5, day: 9 }, //День Победы
  { month: 7, day: 6 }, //День Столицы
  { month: 8, day: 30 }, //День Конституции
  { month: 10, day: 25 }, //День Республики
  { month: 12, day: 1 }, //День Первого Президента
  { month: 12, day: 16 }, //День Независимости
  { month: 12, day: 17 }, //День Независимости (продолжение)
];

//генерирует все выходные (суббота + воскресенье) за год
function getWeekends(year: number): HolidayCalendarEntry[] {
  const weekends: HolidayCalendarEntry[] = [];
  const date = new Date(year, 0, 1);

  while (date.getFullYear() === year) {
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekends.push({
        month: date.getMonth() + 1,
        day: date.getDate(),
      });
    }

    date.setDate(date.getDate() + 1);
  }

  return weekends;
}

//объединяет праздники + выходные, убирает дубликаты
export function generateHolidaysForYear(year: number): HolidayCalendarEntry[] {
  const weekends = getWeekends(year);
  const all = [...KZ_FIXED_HOLIDAYS, ...weekends];

  //убираем дубликаты
  const unique = new Map<string, HolidayCalendarEntry>();

  for (const entry of all) {
    const key = `${entry.month}-${entry.day}`;
    if (!unique.has(key)) unique.set(key, entry);
  }

  return Array.from(unique.values()).sort(
    (a, b) => a.month - b.month || a.day - b.day,
  );
}
