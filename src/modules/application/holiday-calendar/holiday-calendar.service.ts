import { Injectable, Logger } from '@nestjs/common';
import { HolidayCalendarRepository } from './holiday-calendar.repository';
import { ProductionCalendarService } from '../../vendors/production-calendar/production-calendar.service';
import { HolidayCalendarMessages } from './constants/holiday-calendar.messages';
import type { HolidayCalendar } from './holiday-calendar.schema';

@Injectable()
export class HolidayCalendarService {
  private readonly logger = new Logger(HolidayCalendarService.name);

  constructor(
    private readonly holidayCalendarRepository: HolidayCalendarRepository,
    private readonly productionCalendarService: ProductionCalendarService,
  ) {}

  //возвращает календарь из базы, если нет то загружает и сохраняет
  async getOrFetchCalendar(year: number): Promise<HolidayCalendar> {
    const existing = await this.holidayCalendarRepository.findOne({ year });

    if (existing) {
      this.logger.log(
        `${HolidayCalendarMessages.HOLIDAY_CALENDAR_FOUND}: ${year}`,
      );
      return existing;
    }

    return this.fetchAndSaveCalendar(year);
  }

  //принудительно загружает календарь и сохраняет в базу
  async fetchAndSaveCalendar(year: number): Promise<HolidayCalendar> {
    const parsed = await this.productionCalendarService.fetchHolidays(year);

    const calendar = await this.holidayCalendarRepository.updateOne(
      { year: parsed.year },
      { $set: { year: parsed.year, holidays: parsed.holidays } },
      { upsert: true, new: true },
    );

    this.logger.log(
      `${HolidayCalendarMessages.HOLIDAY_CALENDAR_FETCHED_AND_SAVED}: ${year}, ${parsed.holidays.length} holidays`,
    );

    return calendar as HolidayCalendar;
  }

  //проверяет, является ли указанная дата нерабочим днём
  async isHoliday(date: Date): Promise<boolean> {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const calendar = await this.getOrFetchCalendar(year);

    return calendar.holidays.some(
      (holiday) => holiday.month === month && holiday.day === day,
    );
  }
}
