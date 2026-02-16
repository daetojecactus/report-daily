import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HolidayCalendarRepository } from '../../application/holiday-calendar/holiday-calendar.repository';
import { generateHolidaysForYear } from './constants/holidays-seed';
import { HolidaySeedMessages } from './constants/holiday-seed.messages';

@Injectable()
export class HolidaySeedTask implements OnModuleInit {
  private readonly logger = new Logger(HolidaySeedTask.name);

  constructor(
    private readonly holidayCalendarRepository: HolidayCalendarRepository,
  ) {}

  //при старте приложения проверяем и заполняем праздники на текущий и следующий год
  async onModuleInit(): Promise<void> {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1];

    for (const year of years) {
      await this.seedYear(year);
    }
  }

  //заполняет праздники за год, если записи ещё нет
  private async seedYear(year: number): Promise<void> {
    const existing = await this.holidayCalendarRepository.findOne({ year });

    if (existing) {
      this.logger.log(`${HolidaySeedMessages.ALREADY_EXISTS}: ${year}`);
      return;
    }

    const holidays = generateHolidaysForYear(year);

    await this.holidayCalendarRepository.updateOne(
      { year },
      { $set: { year, holidays } },
      { upsert: true, new: true },
    );

    this.logger.log(
      `${HolidaySeedMessages.SEEDED}: ${year}, ${holidays.length} days`,
    );
  }
}
