import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AccessService } from '../access.service';

const ENV: Record<string, string[]> = {
  OWNER_TELEGRAM_IDS: ['100'],
  OWNER_SLACK_IDS: ['U0OWNER01'],
};

describe('AccessService', () => {
  const userService = {
    findOneByChannel: vi.fn<UserService['findOneByChannel']>(),
    recordContact: vi.fn<UserService['recordContact']>(),
  };
  const create = (env: Record<string, string[] | undefined>) =>
    new AccessService(
      { get: (key: string) => env[key] } as unknown as ConfigService<AppEnvs, true>,
      userService as unknown as UserService,
      new I18nService(),
    );
  const resolve = (service: AccessService, channel: Channel, userId: string) =>
    service.resolveActor({
      channel,
      userId,
      chatId: userId,
      languageCode: 'en',
      input: { type: ChatInputType.COMMAND, command: 'start' },
    });

  beforeEach(() => {
    vi.resetAllMocks();
    userService.findOneByChannel.mockResolvedValue(null);
  });

  it('knows the owners of each channel by their own ids', async () => {
    const service = create(ENV);

    expect((await resolve(service, Channel.SLACK, 'U0OWNER01')).isOwner).toBe(true);
    expect((await resolve(service, Channel.TELEGRAM, '100')).isOwner).toBe(true);
    expect((await resolve(service, Channel.SLACK, '100')).isOwner).toBe(false);
    expect((await resolve(service, Channel.TELEGRAM, 'U0OWNER01')).isOwner).toBe(false);
  });

  it('has no Slack owners without the Slack variables', async () => {
    const service = create({ OWNER_TELEGRAM_IDS: ['100'] });

    expect((await resolve(service, Channel.SLACK, 'U0OWNER01')).isOwner).toBe(false);
  });
});
