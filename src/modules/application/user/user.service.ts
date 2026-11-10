import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { and, arrayContains, eq, isNull, not, sql, type SQL } from 'drizzle-orm';
import type { Channel } from 'src/common/enums/channel.enums';
import type { Language } from 'src/modules/application/i18n/i18n.enums';
import type { Source } from 'src/modules/application/source/source.enums';
import { ChannelService } from './channel/channel.service';
import { USER_LIKE_SPECIAL_CHARACTERS } from './constants/user.constants';
import { type JobRole, type Permission, UserStatus } from './user.enums';
import type { UserInsert, UserSettingsUpdate, UserUpdate, UserWithChannel } from './user.interface';
import { UserRepository } from './user.repository';
import { users } from './user.schema';
import type { UserSourceInsert } from './user-source/user-source.interface';
import { UserSourceService } from './user-source/user-source.service';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly channelService: ChannelService,
    private readonly userSourceService: UserSourceService,
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

  updateOne(filter: SQL, values: UserUpdate) {
    return this.userRepository.updateOne(filter, values);
  }

  deleteOne(filter: SQL) {
    return this.userRepository.deleteOne(filter);
  }

  findById(id: string) {
    return this.findOne(eq(users.id, id));
  }

  findOneBySource(source: Source, externalId: string) {
    return this.userRepository.findOneBySource(source, externalId);
  }

  findPage(limit: number, offset: number) {
    return this.userRepository.findPage(undefined, limit, offset);
  }

  count() {
    return this.userRepository.count();
  }

  countByTemplate(templateId: string) {
    return this.userRepository.count(eq(users.templateId, templateId));
  }

  search(query: string, limit: number) {
    return this.userRepository.search(
      `%${query.replace(USER_LIKE_SPECIAL_CHARACTERS, '\\$&')}%`,
      limit,
    );
  }

  findScheduled() {
    return this.userRepository.findWithReachableChannel(
      and(eq(users.status, UserStatus.ACTIVE), eq(users.scheduleEnabled, true)),
    );
  }

  async findRecipients(channels: Channel[]) {
    const rows = await this.userRepository.findReachable(
      channels,
      eq(users.status, UserStatus.ACTIVE),
    );
    return rows.map(({ channel }) => channel);
  }

  findOneByChannel(channel: Channel, externalId: string) {
    return this.userRepository.findOneByChannel(channel, externalId);
  }

  updateSettings(id: string, update: UserSettingsUpdate) {
    return this.updateOne(eq(users.id, id), update);
  }

  changeRole(id: string, role: JobRole) {
    return this.updateOne(eq(users.id, id), { role });
  }

  block(id: string) {
    return this.updateOne(eq(users.id, id), { status: UserStatus.BLOCKED });
  }

  async unblock(id: string) {
    const channels = await this.channelService.findByUser(id);
    return this.updateOne(and(eq(users.id, id), eq(users.status, UserStatus.BLOCKED))!, {
      status: channels.length > 0 ? UserStatus.ACTIVE : UserStatus.PENDING,
    });
  }

  grantPermission(id: string, permission: Permission) {
    return this.updateOne(
      and(eq(users.id, id), not(arrayContains(users.permissions, [permission])))!,
      { permissions: sql`array_append(${users.permissions}, ${permission})` },
    );
  }

  revokePermission(id: string, permission: Permission) {
    return this.updateOne(and(eq(users.id, id), arrayContains(users.permissions, [permission]))!, {
      permissions: sql`array_remove(${users.permissions}, ${permission})`,
    });
  }

  deleteById(id: string) {
    return this.deleteOne(eq(users.id, id));
  }

  @Transactional()
  async createWithSource(values: UserInsert, account: Omit<UserSourceInsert, 'userId'>) {
    const user = await this.create(values);
    await this.userSourceService.create({ ...account, userId: user.id });
    return user;
  }

  @Transactional()
  async bindChannel(userId: string, channel: Channel, externalId: string) {
    const created = await this.channelService.create({
      userId,
      channel,
      externalId,
    });
    await this.updateOne(and(eq(users.id, userId), eq(users.status, UserStatus.PENDING))!, {
      status: UserStatus.ACTIVE,
    });
    return created;
  }

  async recordContact({ user, channel }: UserWithChannel, language: Language) {
    if (user.language === null) {
      await this.updateOne(and(eq(users.id, user.id), isNull(users.language))!, { language });
    }
    if (!channel.reachable) {
      await this.channelService.updateReachable(channel.channel, channel.externalId, true);
    }
  }
}
