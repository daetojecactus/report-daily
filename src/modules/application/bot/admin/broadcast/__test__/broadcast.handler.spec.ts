import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatChannel, ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserChannel } from 'src/modules/application/user/channel/types/channel.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import { DeliveryMode } from 'src/modules/infrastructure/config/types/config.enums';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import type { DeliveryQueueProducer } from 'src/modules/queue/delivery/delivery-queue.producer';
import type { AccessService } from '../../../core/access.service';
import type { BotDialog } from '../../../core/types/bot.interface';
import { BroadcastHandler } from '../broadcast.handler';
import { DialogService } from '../../../core/dialog.service';
import type { RedisService } from 'src/modules/infrastructure/redis/redis.service';

const locale = new I18nService().getLocale(Language.EN);
const texts = locale.broadcast;
const CANCEL = { text: 'Cancel', data: 'bcast:cancel' };
const MENU = [[{ text: 'Menu', data: 'adm:menu' }]];
const RECIPIENTS = [
  { userId: 'user-1', channel: Channel.TELEGRAM, externalId: '2001' },
  { userId: 'user-1', channel: Channel.SLACK, externalId: 'U0ANNA01' },
  { userId: 'user-2', channel: Channel.TELEGRAM, externalId: '2002' },
  { userId: 'user-3', channel: Channel.SLACK, externalId: 'U0BORIS1' },
] as UserChannel[];
const OWNERS: Record<Channel, string[]> = {
  [Channel.TELEGRAM]: ['100', '101'],
  [Channel.SLACK]: ['U0OWNER1'],
};

function dialog(step: string, data: Record<string, unknown> = {}): BotDialog {
  return { namespace: 'bcast', step, data };
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

function text(value: string): ChatInput {
  return { type: ChatInputType.TEXT, text: value };
}

describe('BroadcastHandler', () => {
  const userService = { findRecipients: vi.fn<UserService['findRecipients']>() };
  const accessService = { findOwnerIds: vi.fn<AccessService['findOwnerIds']>() };
  const producer = { addBroadcast: vi.fn<DeliveryQueueProducer['addBroadcast']>() };
  const createHandler = (mode: DeliveryMode) =>
    new BroadcastHandler(
      userService as unknown as UserService,
      accessService as unknown as AccessService,
      producer as unknown as DeliveryQueueProducer,
      [{ channel: Channel.TELEGRAM }, { channel: Channel.SLACK }] as ChatChannel[],
      { get: () => mode } as unknown as ConfigService<AppEnvs, true>,
      new DialogService({} as RedisService),
    );
  const open = (input: ChatInput, current: BotDialog | null = null, mode = DeliveryMode.LIVE) =>
    createHandler(mode).handle({
      actor: {
        channel: Channel.TELEGRAM,
        externalId: '100',
        chatId: '100',
        language: Language.EN,
        isOwner: true,
        user: null,
      },
      locale,
      input,
      dialog: current,
    });

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    userService.findRecipients.mockResolvedValue(RECIPIENTS);
    accessService.findOwnerIds.mockImplementation((channel) => OWNERS[channel]);
  });

  it('asks for the text', async () => {
    expect(await open(button('bcast:start'))).toEqual({
      screen: {
        text: [texts.title, texts.askText(4000)].join('\n'),
        buttons: [[CANCEL]],
      },
      dialog: dialog('text'),
    });
  });

  it('previews the text as it will go out with the number of people in every channel', async () => {
    expect(await open(text('  Standup *moves* to 11:00  '), dialog('text'))).toEqual({
      screen: {
        text: [
          texts.preview,
          '',
          'Standup \\*moves\\* to 11:00',
          '',
          texts.recipients(3),
          texts.previewHint,
        ].join('\n'),
        buttons: [
          [{ text: 'Send (3)', data: 'bcast:send' }],
          [{ text: 'Edit text', data: 'bcast:text' }, CANCEL],
        ],
      },
      dialog: dialog('preview', { text: 'Standup *moves* to 11:00' }),
    });
    expect(userService.findRecipients).toHaveBeenCalledWith([Channel.TELEGRAM, Channel.SLACK]);
  });

  it('takes a new text on the preview and refuses an empty or a too long one', async () => {
    expect((await open(text('New time'), dialog('preview', { text: 'Old time' }))).dialog).toEqual(
      dialog('preview', { text: 'New time' }),
    );

    for (const value of ['   ', 'x'.repeat(4001)]) {
      expect(await open(text(value), dialog('text'))).toMatchObject({
        screen: { text: expect.stringContaining(texts.textInvalid(4000)) as string },
        dialog: dialog('text'),
      });
    }
  });

  it('offers no sending without recipients', async () => {
    userService.findRecipients.mockResolvedValue([]);

    const { screen } = await open(text('Standup'), dialog('text'));

    expect(screen.text).toContain(texts.noRecipients);
    expect(screen.buttons).toEqual([[{ text: 'Edit text', data: 'bcast:text' }, CANCEL]]);
  });

  it('queues the previewed text for every chat of every recipient in its channel', async () => {
    expect(await open(button('bcast:send'), dialog('preview', { text: 'Standup *11*' }))).toEqual({
      screen: { text: texts.sent(3), buttons: MENU },
      dialog: null,
    });
    const message = (chatId: string) => ({ chatId, text: 'Standup \\*11\\*' });
    const [[, broadcastId]] = producer.addBroadcast.mock.calls;
    expect(broadcastId).toMatch(/^[\da-f-]{36}$/);
    expect(producer.addBroadcast.mock.calls).toEqual([
      [Channel.TELEGRAM, broadcastId, [message('2001'), message('2002')]],
      [Channel.SLACK, broadcastId, [message('U0ANNA01'), message('U0BORIS1')]],
    ]);
  });

  it('skips a channel without recipients', async () => {
    userService.findRecipients.mockResolvedValue(RECIPIENTS.slice(2, 3));

    await open(button('bcast:send'), dialog('preview', { text: 'Standup' }));

    expect(producer.addBroadcast).toHaveBeenCalledOnce();
    expect(producer.addBroadcast.mock.calls[0][0]).toBe(Channel.TELEGRAM);
  });

  it('sends one copy to the owners of each channel in the check mode', async () => {
    expect(
      await open(
        button('bcast:send'),
        dialog('preview', { text: 'Standup' }),
        DeliveryMode.REDIRECT,
      ),
    ).toEqual({ screen: { text: texts.sentRedirected(3), buttons: MENU }, dialog: null });
    const copy = (chatId: string) => ({
      chatId,
      text: [texts.redirected(3), '', 'Standup'].join('\n'),
    });
    expect(
      producer.addBroadcast.mock.calls.map(([channel, , messages]) => [channel, messages]),
    ).toEqual([
      [Channel.TELEGRAM, [copy('100'), copy('101')]],
      [Channel.SLACK, [copy('U0OWNER1')]],
    ]);
  });

  it('sends nothing without a preview and cancels on request', async () => {
    expect(await open(button('bcast:send'), dialog('text'))).toEqual({
      screen: { text: locale.bot.expired },
      dialog: null,
    });
    expect(await open(button('bcast:cancel'), dialog('preview', { text: 'Standup' }))).toEqual({
      screen: { text: texts.cancelled, buttons: MENU },
      dialog: null,
    });
    expect(producer.addBroadcast).not.toHaveBeenCalled();
  });
});
