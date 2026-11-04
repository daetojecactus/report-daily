import { Injectable } from '@nestjs/common';
import { and, eq, ne, type SQL } from 'drizzle-orm';
import type { Channel } from 'src/common/enums/channel.enums';
import type { UserChannelInsert } from './channel.interface';
import { ChannelRepository } from './channel.repository';
import { userChannels } from './channel.schema';

@Injectable()
export class ChannelService {
  constructor(private readonly channelRepository: ChannelRepository) {}

  updateOne(filter: SQL, values: Partial<UserChannelInsert>) {
    return this.channelRepository.updateOne(filter, values);
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
