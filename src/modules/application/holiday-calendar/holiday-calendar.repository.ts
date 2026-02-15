import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, UpdateQuery, QueryOptions } from 'mongoose';
import {
  HolidayCalendar,
  HolidayCalendarDocument,
} from './holiday-calendar.schema';

@Injectable()
export class HolidayCalendarRepository {
  constructor(
    @InjectModel(HolidayCalendar.name)
    private readonly model: Model<HolidayCalendarDocument>,
  ) {}

  async findOne(filter: QueryFilter<HolidayCalendarDocument>) {
    return this.model.findOne(filter);
  }

  async create(data: Partial<HolidayCalendar>) {
    return this.model.create(data);
  }

  async updateOne(
    filter: QueryFilter<HolidayCalendarDocument>,
    update: UpdateQuery<HolidayCalendarDocument>,
    options?: QueryOptions<HolidayCalendarDocument>,
  ) {
    return this.model.findOneAndUpdate(filter, update, options);
  }
}
