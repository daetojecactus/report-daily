import { Module } from '@nestjs/common';
import { ProductionCalendarClient } from './production-calendar.client';
import { ProductionCalendarRepository } from './production-calendar.repository';
import { ProductionCalendarService } from './production-calendar.service';

@Module({
  providers: [
    ProductionCalendarClient,
    ProductionCalendarRepository,
    ProductionCalendarService,
  ],
  exports: [ProductionCalendarService],
})
export class ProductionCalendarModule {}
