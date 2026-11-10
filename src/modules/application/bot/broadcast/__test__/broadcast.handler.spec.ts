import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserService } from 'src/modules/application/user/user.service';
import { DeliveryMode } from 'src/modules/infrastructure/config/config.enums';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import type { DeliveryTelegramQueueProducer } from 'src/modules/queue/delivery-telegram/delivery-telegram-queue.producer';
import type { BotDialog } from '../../bot.interface';
import { BroadcastHandler } from '../broadcast.handler';

const locale = new I18nService().getLocale(Language.EN);
const texts = locale.broadcast;
const CANCEL = { text: 'Cancel', data: 'bcast:cancel' };
const MENU = [[{ text: '‹ Menu', data: 'adm:menu' }]];
const CHATS = ['2001', '2002', '2003'];

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
  const userService = { findRecipientChats: vi.fn<UserService['findRecipientChats']>() };
  const producer = { addBroadcast: vi.fn<DeliveryTelegramQueueProducer['addBroadcast']>() };
  const createHandler = (mode: DeliveryMode) =>
    new BroadcastHandler(
      userService as unknown as UserService,
      producer as unknown as DeliveryTelegramQueueProducer,
      {
        get: (key: string) => (key === 'DELIVERY_MODE' ? mode : ['100', '101']),
      } as unknown as ConfigService<AppEnvs, true>,
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
    userService.findRecipientChats.mockResolvedValue(CHATS);
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

  it('previews the text as it will go out with the number of recipients', async () => {
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
    expect(userService.findRecipientChats).toHaveBeenCalledWith(Channel.TELEGRAM);
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
    userService.findRecipientChats.mockResolvedValue([]);

    const { screen } = await open(text('Standup'), dialog('text'));

    expect(screen.text).toContain(texts.noRecipients);
    expect(screen.buttons).toEqual([[{ text: 'Edit text', data: 'bcast:text' }, CANCEL]]);
  });

  it('queues the previewed text for every recipient', async () => {
    expect(await open(button('bcast:send'), dialog('preview', { text: 'Standup *11*' }))).toEqual({
      screen: { text: texts.sent(3), buttons: MENU },
      dialog: null,
    });
    const [broadcastId, messages] = producer.addBroadcast.mock.calls[0];
    expect(broadcastId).toMatch(/^[\da-f-]{36}$/);
    expect(messages).toEqual(CHATS.map((chatId) => ({ chatId, text: 'Standup \\*11\\*' })));
  });

  it('sends one copy to the owners in the check mode', async () => {
    expect(
      await open(
        button('bcast:send'),
        dialog('preview', { text: 'Standup' }),
        DeliveryMode.REDIRECT,
      ),
    ).toEqual({ screen: { text: texts.sentRedirected(3), buttons: MENU }, dialog: null });
    const copy = [texts.redirected(3), '', 'Standup'].join('\n');
    expect(producer.addBroadcast.mock.calls[0][1]).toEqual([
      { chatId: '100', text: copy },
      { chatId: '101', text: copy },
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
