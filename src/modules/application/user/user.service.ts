import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { User } from './user.schema';
import { Settings } from './settings/settings.schema';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findOne(filter: Partial<User>) {
    return this.userRepository.findOne(filter);
  }

  async find(filter?: Partial<User>) {
    return this.userRepository.find(filter);
  }

  async create(user: User) {
    return this.userRepository.create(user);
  }

  async updateOne(filter: Partial<User>, partialUser: Partial<User>) {
    return this.userRepository.updateOne(filter, partialUser);
  }

  async updateUserSettings(
    filter: Partial<User>,
    partialSettings: Partial<Settings>,
  ) {
    return this.userRepository.updateSettings(filter, partialSettings);
  }
}
