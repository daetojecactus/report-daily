import { Injectable } from '@nestjs/common';
import { ProductionCalendarRepository } from './production-calendar.repository';
import type { ParsedYearHolidays } from './production-calendar.types';

@Injectable()
export class ProductionCalendarService {
  constructor(
    private readonly productionCalendarRepository: ProductionCalendarRepository,
  ) {}

  //загружает праздники за указанный год
  async fetchHolidays(year: number): Promise<ParsedYearHolidays> {
    return this.productionCalendarRepository.fetchHolidays(year);
  }
}
