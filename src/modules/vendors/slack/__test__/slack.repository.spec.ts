import type { ConfigService } from '@nestjs/config';
import { WebAPIPlatformError } from '@slack/web-api';
import { describe, expect, it, vi } from 'vitest';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { SlackClient } from '../slack.client';
import { SlackRejectedError } from '../slack.error';
import { SlackRepository } from '../slack.repository';

const CONTENT = { text: 'Report', blocks: [] };

describe('SlackRepository', () => {
  const client = new SlackClient({
    get: (key: string) => (key === 'SLACK_API_URL' ? 'https://slack.com/api' : 'xoxb-test'),
  } as unknown as ConfigService<AppEnvs, true>);
  const repository = new SlackRepository(client);
  const postMessage = vi.spyOn(client.instance!.chat, 'postMessage');
  const usersInfo = vi.spyOn(client.instance!.users, 'info');

  it('turns a Slack platform error into a rejection with its code', async () => {
    postMessage.mockRejectedValueOnce(
      new WebAPIPlatformError({ ok: false, error: 'not_in_channel' }),
    );

    await expect(repository.postMessage('D100', CONTENT)).rejects.toMatchObject({
      constructor: SlackRejectedError,
      code: 'not_in_channel',
      message: 'Slack rejected the request: not_in_channel',
    });
  });

  it('passes other errors on for a retry', async () => {
    const network = new Error('socket hang up');
    postMessage.mockRejectedValueOnce(network);

    await expect(repository.postMessage('D100', CONTENT)).rejects.toBe(network);
  });

  it('adds the trailing slash the Slack client needs to the API address', () => {
    expect(client.apiUrl).toBe('https://slack.com/api/');
  });

  it('reads the locale of a member profile', async () => {
    usersInfo.mockResolvedValueOnce({ ok: true, user: { locale: 'ru-RU' } });

    await expect(repository.findLocale('U0EMPLOY1')).resolves.toBe('ru-RU');
    expect(usersInfo).toHaveBeenCalledWith({ user: 'U0EMPLOY1', include_locale: true });
  });

  it('returns the channel and the time stamp of the posted message', async () => {
    postMessage.mockResolvedValueOnce({ ok: true, channel: 'D100', ts: '1731240000.000100' });

    await expect(repository.postMessage('D100', CONTENT)).resolves.toEqual({
      channel: 'D100',
      ts: '1731240000.000100',
    });
  });
});
