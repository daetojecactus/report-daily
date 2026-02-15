//один нерабочий день (праздник или выходной)
export interface HolidayDay {
  month: number;
  day: number;
}

//ответ парсера: все нерабочие дни за год
export interface ParsedYearHolidays {
  year: number;
  holidays: HolidayDay[];
}
