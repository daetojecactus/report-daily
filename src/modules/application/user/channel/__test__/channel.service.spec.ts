import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import type { UserChannel } from '../types/channel.interface';
import type { ChannelRepository } from '../channel.repository';
import { ChannelService } from '../channel.service';

function chat(channel: Channel, values: Partial<UserChannel> = {}) {
  return { channel, reachable: true, receives: true, ...values } as UserChannel;
}

describe('ChannelService', () => {
  const repository = {
    find: vi.fn<ChannelRepository['find']>(),
    updateOne: vi.fn<ChannelRepository['updateOne']>(),
  };
  const service = new ChannelService(repository as unknown as ChannelRepository);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('takes the channels that are on, or all of them when none is', () => {
    const telegram = chat(Channel.TELEGRAM);
    const slack = chat(Channel.SLACK, { receives: false });

    expect(service.toReceiving([telegram, slack])).toEqual([telegram]);
    expect(
      service.toReceiving([{ ...telegram, receives: false }, slack]).map(({ channel }) => channel),
    ).toEqual([Channel.TELEGRAM, Channel.SLACK]);
  });

  it('finds the reachable channels that get reports among the configured ones', async () => {
    repository.find.mockResolvedValue([
      chat(Channel.TELEGRAM, { reachable: false }),
      chat(Channel.SLACK, { receives: false }),
    ] as never);

    expect(await service.findReceiving('user-1', [Channel.TELEGRAM, Channel.SLACK])).toEqual([]);
    expect(await service.findReceiving('user-1', [Channel.SLACK])).toEqual([
      chat(Channel.SLACK, { receives: false }),
    ]);
  });

  it('switches every given channel on or off', async () => {
    await service.updateReceiving('user-1', [Channel.TELEGRAM, Channel.SLACK], [Channel.SLACK]);

    expect(repository.updateOne.mock.calls.map(([, values]) => values)).toEqual([
      { receives: false },
      { receives: true },
    ]);
  });
});
