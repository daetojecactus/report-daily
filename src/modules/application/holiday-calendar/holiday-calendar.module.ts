import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  HolidayCalendar,
  HolidayCalendarSchema,
} from './holiday-calendar.schema';
import { HolidayCalendarRepository } from './holiday-calendar.repository';
import { HolidayCalendarService } from './holiday-calendar.service';
import { ProductionCalendarModule } from '../../vendors/production-calendar/production-calendar.module';
import { VendorModule } from 'src/modules/vendors/vendor.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HolidayCalendar.name, schema: HolidayCalendarSchema },
    ]),
    VendorModule,
  ],
  providers: [HolidayCalendarRepository, HolidayCalendarService],
  exports: [HolidayCalendarService, HolidayCalendarRepository],
})
export class HolidayCalendarModule {}
