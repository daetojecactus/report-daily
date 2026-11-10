import type { ConfigService } from '@nestjs/config';
import { WebAPIPlatformError } from '@slack/web-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatUnreachableError } from 'src/common/errors/chat-unreachable.error';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { SlackClient } from '../slack.client';
import { SlackFormatter } from '../slack.formatter';
import { SlackRenderer } from '../slack.renderer';
import type { SlackRepository } from '../slack.repository';
import { SlackService } from '../slack.service';

const SCREEN = { text: 'Report', buttons: [[{ text: 'Rebuild', data: 'rpt:rebuild:2026-11-10' }]] };

function client(token?: string) {
  return new SlackClient({ get: () => token } as unknown as ConfigService<AppEnvs, true>);
}

function platformError(error: string) {
  return new WebAPIPlatformError({ ok: false, error });
}

describe('SlackService', () => {
  const repository = {
    postMessage: vi.fn<SlackRepository['postMessage']>(),
    updateMessage: vi.fn<SlackRepository['updateMessage']>(),
  };
  const renderer = new SlackRenderer(new SlackFormatter());
  const service = new SlackService(
    client('xoxb-test'),
    repository as unknown as SlackRepository,
    renderer,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    repository.postMessage.mockResolvedValue({ channel: 'D100', ts: '1731240000.000100' });
  });

  it('is on only with a bot token and knows Slack member ids', () => {
    expect(service.isEnabled()).toBe(true);
    expect(
      new SlackService(client(), repository as unknown as SlackRepository, renderer).isEnabled(),
    ).toBe(false);
    expect(['U0123ABCD', 'W0123ABCD', '12345', 'u0123'].map((id) => service.isUserId(id))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('posts a screen and returns the message ts', async () => {
    expect(await service.sendScreen('U0123ABCD', SCREEN)).toBe('1731240000.000100');
    expect(repository.postMessage).toHaveBeenCalledWith('U0123ABCD', renderer.render(SCREEN));
  });

  it('updates a message and posts a new one when the old is gone', async () => {
    await service.editScreen('D100', '1.1', SCREEN);
    expect(repository.updateMessage).toHaveBeenCalledWith('D100', '1.1', renderer.render(SCREEN));

    repository.updateMessage.mockRejectedValueOnce(platformError('message_not_found'));
    await service.editScreen('D100', '1.2', SCREEN);
    expect(repository.postMessage).toHaveBeenCalledWith('D100', renderer.render(SCREEN));
  });

  it('reports a member Slack cannot reach as an unreachable chat', async () => {
    repository.postMessage.mockRejectedValueOnce(platformError('user_not_found'));
    await expect(service.sendScreen('U0123ABCD', SCREEN)).rejects.toBeInstanceOf(
      ChatUnreachableError,
    );

    repository.postMessage.mockRejectedValueOnce(platformError('invalid_blocks'));
    await expect(service.sendScreen('U0123ABCD', SCREEN)).rejects.toBeInstanceOf(
      WebAPIPlatformError,
    );
  });

  it('needs no button answers and no command menus', async () => {
    await expect(service.answerButton()).resolves.toBeUndefined();
    await expect(service.setDefaultCommands()).resolves.toBeUndefined();
    await expect(service.setChatCommands()).resolves.toBeUndefined();
  });
});
