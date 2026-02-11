import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Invite, InviteDocument } from './invite.schema';
import { Model, QueryFilter, UpdateQuery, QueryOptions } from 'mongoose';

@Injectable()
export class InviteRepository {
  constructor(
    @InjectModel(Invite.name)
    private readonly inviteModel: Model<InviteDocument>,
  ) {}

  async findOne(filter: QueryFilter<InviteDocument>) {
    return this.inviteModel.findOne(filter);
  }

  find(filter?: QueryFilter<InviteDocument>) {
    return this.inviteModel.find(filter ?? {});
  }

  async create(invite: Partial<Invite>) {
    return this.inviteModel.create(invite);
  }

  async updateOne(
    filter: QueryFilter<InviteDocument>,
    update: UpdateQuery<InviteDocument>,
    options?: QueryOptions<InviteDocument>,
  ) {
    return await this.inviteModel.findOneAndUpdate(filter, update, options);
  }

  async deleteOne(filter: QueryFilter<InviteDocument>) {
    return this.inviteModel.findOneAndDelete(filter);
  }
}
