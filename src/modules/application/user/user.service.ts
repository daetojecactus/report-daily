import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { and, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import type { Channel } from 'src/common/enums/channel.enums';
import type { Language } from 'src/modules/application/i18n/i18n.enums';
import { ChannelService } from './channel/channel.service';
import { USER_LIKE_SPECIAL_CHARACTERS } from './constants/user.constants';
import { type JobRole, UserStatus } from './user.enums';
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

  findById(id: string) {
    return this.findOne(eq(users.id, id));
  }

  findByGitlabId(gitlabUserId: number) {
    return this.findOne(eq(users.gitlabUserId, gitlabUserId));
  }

  findPage(limit: number, offset: number) {
    return this.userRepository.findPage(undefined, limit, offset);
  }

  count() {
    return this.userRepository.count();
  }

  search(query: string, limit: number) {
    const pattern = `%${query.replace(USER_LIKE_SPECIAL_CHARACTERS, '\\$&')}%`;
    return this.userRepository.findPage(
      or(
        ilike(users.displayName, pattern),
        ilike(users.gitlabUsername, pattern),
      ),
      limit,
      0,
    );
  }

  findOneByChannel(channel: Channel, externalId: string) {
    return this.userRepository.findOneByChannel(channel, externalId);
  }

  changeRole(id: string, role: JobRole) {
    return this.updateOne(eq(users.id, id), { role });
  }

  block(id: string) {
    return this.updateOne(eq(users.id, id), { status: UserStatus.BLOCKED });
  }

  async unblock(id: string) {
    const channels = await this.channelService.findByUser(id);
    return this.updateOne(
      and(eq(users.id, id), eq(users.status, UserStatus.BLOCKED))!,
      {
        status: channels.length > 0 ? UserStatus.ACTIVE : UserStatus.PENDING,
      },
    );
  }

  deleteById(id: string) {
    return this.deleteOne(eq(users.id, id));
  }

  @Transactional()
  async bindChannel(userId: string, channel: Channel, externalId: string) {
    const created = await this.channelService.create({
      userId,
      channel,
      externalId,
    });
    await this.updateOne(
      and(eq(users.id, userId), eq(users.status, UserStatus.PENDING))!,
      { status: UserStatus.ACTIVE },
    );
    return created;
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
