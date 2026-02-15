import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, UpdateQuery, QueryOptions } from 'mongoose';
import { BotSettings, BotSettingsDocument } from './bot-settings.schema';

@Injectable()
export class BotSettingsRepository {
  constructor(
    @InjectModel(BotSettings.name)
    private readonly model: Model<BotSettingsDocument>,
  ) {}

  async findOne(filter: QueryFilter<BotSettingsDocument>) {
    return this.model.findOne(filter);
  }

  async create(data: Partial<BotSettings>) {
    return this.model.create(data);
  }

  async updateOne(
    filter: QueryFilter<BotSettingsDocument>,
    update: UpdateQuery<BotSettingsDocument>,
    options?: QueryOptions<BotSettingsDocument>,
  ) {
    return this.model.findOneAndUpdate(filter, update, options);
  }
}
