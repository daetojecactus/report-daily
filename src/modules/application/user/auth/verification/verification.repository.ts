import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Verification, VerificationDocument } from './verification.schema';
import { Model, QueryFilter, UpdateQuery, QueryOptions } from 'mongoose';

@Injectable()
export class VerificationRepository {
  constructor(
    @InjectModel(Verification.name)
    private readonly verificationModel: Model<VerificationDocument>,
  ) {}

  async findOne(filter: Partial<Verification>) {
    return this.verificationModel.findOne(filter);
  }

  async create(verification: Verification) {
    return this.verificationModel.create(verification);
  }

  async updateOne(
    filter: QueryFilter<VerificationDocument>,
    update: UpdateQuery<VerificationDocument>,
    options?: QueryOptions<VerificationDocument>,
  ) {
    return await this.verificationModel.findOneAndUpdate(
      filter,
      update,
      options,
    );
  }

  async deleteOne(filter: QueryFilter<VerificationDocument>) {
    await this.verificationModel.findOneAndDelete(filter);
  }
}
