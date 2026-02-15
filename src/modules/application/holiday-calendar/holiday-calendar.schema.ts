import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { HolidayCalendarEntry } from './embedded/holiday-calendar-entry.schema';

@Schema({ collection: 'holiday_calendar', timestamps: true })
export class HolidayCalendar {
  @Prop({ required: true, unique: true })
  year!: number;

  @Prop({ type: [HolidayCalendarEntry], default: [] })
  holidays!: HolidayCalendarEntry[];
}

export type HolidayCalendarDocument = HydratedDocument<HolidayCalendar>;
export const HolidayCalendarSchema =
  SchemaFactory.createForClass(HolidayCalendar);
