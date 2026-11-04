import { Injectable } from '@nestjs/common';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { Channel } from 'src/common/enums/channel.enums';
import type { Language } from 'src/modules/application/i18n/i18n.enums';
import { ChannelService } from './channel/channel.service';
import type { UserInsert, UserWithChannel } from './user.interface';
import { UserRepository } from './user.repository';
import { users } from './user.schema';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly channelService: ChannelService,
  ) {}

  find(filter?: SQL) {
    return this.userRepository.find(filter);
  }

  findOne(filter: SQL) {
    return this.userRepository.findOne(filter);
  }

  create(values: UserInsert) {
    return this.userRepository.create(values);
  }

  updateOne(filter: SQL, values: Partial<UserInsert>) {
    return this.userRepository.updateOne(filter, values);
  }

  deleteOne(filter: SQL) {
    return this.userRepository.deleteOne(filter);
  }

  findOneByChannel(channel: Channel, externalId: string) {
    return this.userRepository.findOneByChannel(channel, externalId);
  }

  async recordContact({ user, channel }: UserWithChannel, language: Language) {
    if (user.language === null) {
      await this.updateOne(
        and(eq(users.id, user.id), isNull(users.language))!,
        { language },
      );
    }
    if (!channel.reachable) {
      await this.channelService.updateReachable(
        channel.channel,
        channel.externalId,
        true,
      );
    }
  }
}
