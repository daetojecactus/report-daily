import { Prop } from '@nestjs/mongoose';

export class HolidayCalendarEntry {
  @Prop({ required: true })
  month!: number;

  @Prop({ required: true })
  day!: number;
}
