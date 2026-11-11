import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatUnreachableError } from 'src/common/channel/chat-unreachable.error';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { SlackClient } from '../slack.client';
import { SlackFormatter } from '../slack.formatter';
import { SlackRejectedError } from '../slack.error';
import { SlackRenderer } from '../slack.renderer';
import type { SlackRepository } from '../slack.repository';
import { SlackService } from '../slack.service';

const SCREEN = { text: 'Report', buttons: [[{ text: 'Rebuild', data: 'rpt:rebuild:2026-11-10' }]] };

function client(token?: string) {
  return new SlackClient({ get: () => token } as unknown as ConfigService<AppEnvs, true>);
}

function rejected(code: string) {
  return new SlackRejectedError(`Slack rejected the request: ${code}`, code);
}

describe('SlackService', () => {
  const repository = {
    postMessage: vi.fn<SlackRepository['postMessage']>(),
    updateMessage: vi.fn<SlackRepository['updateMessage']>(),
    findLocale: vi.fn<SlackRepository['findLocale']>(),
  };
  const formatter = new SlackFormatter();
  const renderer = new SlackRenderer(formatter);
  const service = new SlackService(
    client('xoxb-test'),
    repository as unknown as SlackRepository,
    renderer,
    formatter,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    repository.postMessage.mockResolvedValue({ channel: 'D100', ts: '1731240000.000100' });
  });

  it('is on only with a bot token and knows Slack member ids', () => {
    expect(service.isEnabled()).toBe(true);
    expect(
      new SlackService(
        client(),
        repository as unknown as SlackRepository,
        renderer,
        formatter,
      ).isEnabled(),
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

    repository.updateMessage.mockRejectedValueOnce(rejected('message_not_found'));
    await service.editScreen('D100', '1.2', SCREEN);
    expect(repository.postMessage).toHaveBeenCalledWith('D100', renderer.render(SCREEN));
  });

  it('reports a member Slack cannot reach as an unreachable chat', async () => {
    repository.postMessage.mockRejectedValueOnce(rejected('user_not_found'));
    await expect(service.sendScreen('U0123ABCD', SCREEN)).rejects.toBeInstanceOf(
      ChatUnreachableError,
    );

    repository.postMessage.mockRejectedValueOnce(rejected('invalid_blocks'));
    await expect(service.sendScreen('U0123ABCD', SCREEN)).rejects.toMatchObject({
      constructor: SlackRejectedError,
      code: 'invalid_blocks',
    });

    const network = new Error('socket hang up');
    repository.postMessage.mockRejectedValueOnce(network);
    await expect(service.sendScreen('U0123ABCD', SCREEN)).rejects.toBe(network);
  });

  it('reads the language of a member from the profile and survives a Slack failure', async () => {
    repository.findLocale.mockResolvedValueOnce('ru-RU');
    await expect(service.findLanguageCode('U0EMPLOY1')).resolves.toBe('ru-RU');

    repository.findLocale.mockRejectedValueOnce(new Error('ratelimited'));
    await expect(service.findLanguageCode('U0EMPLOY1')).resolves.toBeNull();
  });

  it('needs no button answers and no command menus', async () => {
    await expect(service.answerButton()).resolves.toBeUndefined();
    await expect(service.setDefaultCommands()).resolves.toBeUndefined();
    await expect(service.setChatCommands()).resolves.toBeUndefined();
  });

  it('runs the slash command as help and with a word as that command in the direct messages', () => {
    expect(service.toChatEvent('slash_commands', { user_id: 'U0EMPLOY1', text: '' })).toEqual({
      channel: 'slack',
      userId: 'U0EMPLOY1',
      chatId: 'U0EMPLOY1',
      languageCode: null,
      input: { type: 'command', command: 'help' },
    });
    expect(
      service.toChatEvent('slash_commands', { user_id: 'U0EMPLOY1', text: ' Report today ' })
        ?.input,
    ).toEqual({ type: 'command', command: 'report' });
  });

  it('takes command words and other text from direct messages and skips bots and edits', () => {
    const message = (event: Record<string, unknown>) => ({
      event_id: 'Ev01',
      event: {
        type: 'message',
        channel_type: 'im',
        channel: 'D100',
        user: 'U0EMPLOY1',
        ...event,
      },
    });

    expect(service.toChatEvent('events_api', message({ text: 'Settings' }))).toMatchObject({
      chatId: 'D100',
      input: { type: 'command', command: 'settings' },
    });
    expect(service.toChatEvent('events_api', message({ text: '/report' }))?.input).toEqual({
      type: 'command',
      command: 'report',
    });
    expect(service.toChatEvent('events_api', message({ text: 'QA daily' }))?.input).toEqual({
      type: 'text',
      text: 'QA daily',
    });
    expect(service.toChatEvent('events_api', message({ text: 'hi', bot_id: 'B1' }))).toBeNull();
    expect(
      service.toChatEvent('events_api', message({ text: 'hi', subtype: 'message_changed' })),
    ).toBeNull();
    expect(
      service.toChatEvent('events_api', message({ text: 'hi', channel_type: 'channel' })),
    ).toBeNull();
    expect(service.findEventId(message({ text: 'hi' }))).toBe('Ev01');
    expect(
      service.toChatEvent(
        'events_api',
        message({ text: '{% if size &gt; 0 %}A &amp; B{% endif %}' }),
      )?.input,
    ).toEqual({ type: 'text', text: '{% if size > 0 %}A & B{% endif %}' });
    expect(service.toChatEvent('events_api', message({ text: '<@U0ANNA01>' }))?.input).toEqual({
      type: 'text',
      text: 'U0ANNA01',
    });
  });

  it('turns a button press and a picked member into chat input', () => {
    const actions = (action: Record<string, unknown>) => ({
      type: 'block_actions',
      user: { id: 'U0EMPLOY1' },
      channel: { id: 'D100' },
      message: { ts: '1731240000.000100' },
      actions: [action],
    });

    expect(
      service.toChatEvent('interactive', actions({ type: 'button', value: 'rpt:menu' })),
    ).toMatchObject({
      userId: 'U0EMPLOY1',
      chatId: 'D100',
      input: {
        type: 'button',
        data: 'rpt:menu',
        messageId: '1731240000.000100',
        callbackId: '',
      },
    });
    expect(
      service.toChatEvent(
        'interactive',
        actions({ type: 'users_select', selected_user: 'U0NEW01' }),
      )?.input,
    ).toEqual({ type: 'picked-user', externalId: 'U0NEW01' });
  });

  it('ignores other envelopes and payloads it does not understand', () => {
    expect(service.toChatEvent('hello', {})).toBeNull();
    expect(service.toChatEvent('interactive', { type: 'view_submission' })).toBeNull();
    expect(service.toChatEvent('slash_commands', { text: 'report' })).toBeNull();
  });
});
