import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './user.schema';
import { Settings } from './settings/settings.schema';
import { UserMessages } from './constants/user.messages';
import { UserStatus } from './user.interface';
import { Model, QueryFilter, UpdateQuery, QueryOptions } from 'mongoose';

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findOne(filter: QueryFilter<UserDocument>) {
    return await this.userModel.findOne(filter);
  }

  find(filter?: QueryFilter<UserDocument>) {
    return this.userModel.find(filter ?? {});
  }

  async create(user: Partial<User>) {
    return await this.userModel.create(user);
  }

  async createMany(users: Partial<User>[]) {
    return await this.userModel.insertMany(users);
  }

  async updateOne(
    filter: QueryFilter<UserDocument>,
    update: UpdateQuery<UserDocument>,
    options?: QueryOptions<UserDocument>,
  ) {
    return await this.userModel.findOneAndUpdate(filter, update, options);
  }

  async findUsersByReportHour(hour: number) {
    return this.userModel.find({
      'settings.reportHour': hour,
      status: UserStatus.ACTIVE,
    });
  }

  async updateSettings(
    filter: Partial<User>,
    partialSettings: Partial<Settings>,
  ) {
    const updateFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(partialSettings)) {
      updateFields[`settings.${key}`] = value;
    }

    const user = await this.userModel.findOneAndUpdate(
      filter,
      { $set: updateFields },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException(UserMessages.USER_NOT_FOUND);
    }

    return user;
  }
}
