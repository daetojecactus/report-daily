import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ProductionCalendarClient } from './production-calendar.client';
import { PRODUCTION_CALENDAR_MONTH_SLUG_TO_NUMBER } from './constants/production-calendar.constants';
import { ProductionCalendarMessages } from './constants/production-calendar.messages';
import type {
  HolidayDay,
  ParsedYearHolidays,
} from './production-calendar.interface';

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

  //извлекает нерабочие дни из HTML производственного календаря lugasoft.ru
  private parseHolidaysFromHtml(html: string): HolidayDay[] {
    const $ = cheerio.load(html);
    const holidays: HolidayDay[] = [];

    //каждый месяц — отдельная таблица с заголовком-ссылкой на этот месяц
    $('table').each((_, tableEl) => {
      //определяем номер месяца по slug в ссылке заголовка
      const href = $(tableEl).find('h3 a').attr('href');
      const slug = href?.split('/').filter(Boolean).pop();
      const monthNumber = slug
        ? PRODUCTION_CALENDAR_MONTH_SLUG_TO_NUMBER[slug]
        : undefined;

      //таблицы без месяца (сводки по кварталам/году) пропускаем
      if (!monthNumber) {
        return;
      }

      //нерабочие дни помечены классом 'v' (выходной/праздник)
      $(tableEl)
        .find('td.day.v')
        .each((_, dayEl) => {
          const dayNumber = parseInt($(dayEl).text().trim(), 10);
          if (!isNaN(dayNumber)) {
            holidays.push({ month: monthNumber, day: dayNumber });
          }
        });
    });

    if (holidays.length === 0) {
      this.logger.warn(
        ProductionCalendarMessages.PRODUCTION_CALENDAR_NO_HOLIDAYS_FOUND,
      );
    }

    return holidays;
  }
}
