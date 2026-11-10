import { Injectable } from '@nestjs/common';
import { and, eq, ne, type SQL } from 'drizzle-orm';
import type { Channel } from 'src/common/enums/channel.enums';
import type { UserChannel, UserChannelInsert } from './channel.interface';
import { ChannelRepository } from './channel.repository';
import { userChannels } from './channel.schema';

@Injectable()
export class ChannelService {
  constructor(private readonly channelRepository: ChannelRepository) {}

  find(filter?: SQL) {
    return this.channelRepository.find(filter);
  }

  findOne(filter: SQL) {
    return this.channelRepository.findOne(filter);
  }

  create(values: UserChannelInsert) {
    return this.channelRepository.create(values);
  }

  updateOne(filter: SQL, values: Partial<UserChannelInsert>) {
    return this.channelRepository.updateOne(filter, values);
  }

  deleteOne(filter: SQL) {
    return this.channelRepository.deleteOne(filter);
  }

  findByUser(userId: string) {
    return this.find(eq(userChannels.userId, userId));
  }

  toReceiving(channels: UserChannel[]) {
    const chosen = channels.filter(({ receives }) => receives);
    return chosen.length > 0 ? chosen : channels;
  }

  async findBound(userId: string, configured: Channel[]) {
    return (await this.findByUser(userId)).filter(({ channel }) => configured.includes(channel));
  }

  async findReceiving(userId: string, configured: Channel[]) {
    return this.toReceiving(await this.findBound(userId, configured)).filter(
      ({ reachable }) => reachable,
    );
  }

  async updateReceiving(userId: string, channels: Channel[], receiving: Channel[]) {
    for (const channel of channels) {
      await this.updateOne(
        and(eq(userChannels.userId, userId), eq(userChannels.channel, channel))!,
        { receives: receiving.includes(channel) },
      );
    }
  }

  updateReachable(channel: Channel, externalId: string, reachable: boolean) {
    return this.updateOne(
      and(
        eq(userChannels.channel, channel),
        eq(userChannels.externalId, externalId),
        ne(userChannels.reachable, reachable),
      )!,
      { reachable },
    );
  }
}
