import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ProductionCalendarClient } from './production-calendar.client';
import { PRODUCTION_CALENDAR_MONTH_NAME_TO_NUMBER } from './constants/production-calendar.constants';
import { ProductionCalendarMessages } from './constants/production-calendar.messages';
import type {
  HolidayDay,
  ParsedYearHolidays,
} from './production-calendar.types';

@Injectable()
export class ProductionCalendarRepository {
  private readonly logger = new Logger(ProductionCalendarRepository.name);

  constructor(private readonly client: ProductionCalendarClient) {}

  //загружает и парсит календарь праздников за указанный год
  async fetchHolidays(year: number): Promise<ParsedYearHolidays> {
    const html = await this.client.fetchCalendarHtml(year);
    const holidays = this.parseHolidaysFromHtml(html);
    return { year, holidays };
  }

  //извлекает нерабочие дни из HTML производственного календаря zakon.kz
  private parseHolidaysFromHtml(html: string): HolidayDay[] {
    const $ = cheerio.load(html);
    const holidays: HolidayDay[] = [];

    const monthDivs = $('div.month-col');

    if (monthDivs.length === 0) {
      this.logger.warn(
        ProductionCalendarMessages.PRODUCTION_CALENDAR_NO_HOLIDAYS_FOUND,
      );
      return holidays;
    }

    monthDivs.each((_, monthEl) => {
      const monthNameEl = $(monthEl).find('h6.text-uppercase.font-weight-bold');
      const monthName = monthNameEl.text().trim().toUpperCase();
      const monthNumber = PRODUCTION_CALENDAR_MONTH_NAME_TO_NUMBER[monthName];

      if (!monthNumber) {
        this.logger.warn(
          `${ProductionCalendarMessages.PRODUCTION_CALENDAR_UNKNOWN_MONTH}: "${monthName}"`,
        );
        return;
      }

      const weekDivs = $(monthEl).find('div.week-row');

      weekDivs.each((_, weekEl) => {
        const holidayDays = $(weekEl).find('div.holiday');

        holidayDays.each((_, dayEl) => {
          const classes = $(dayEl).attr('class') ?? '';

          //пропускаем дни с классом 'masked' (они принадлежат другому месяцу)
          if (classes.includes('masked')) {
            return;
          }

          const dayText = $(dayEl).find('span').text().trim();
          const dayNumber = parseInt(dayText, 10);

          if (!isNaN(dayNumber)) {
            holidays.push({ month: monthNumber, day: dayNumber });
          }
        });
      });
    });

    return holidays;
  }
}
