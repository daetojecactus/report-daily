import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import type { AiService } from 'src/modules/application/ai/ai.service';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { Settings } from 'src/modules/application/settings/types/settings.interface';
import type { SettingsRepository } from 'src/modules/application/settings/settings.repository';
import { SettingsService } from 'src/modules/application/settings/settings.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { AdminSettingsHandler } from '../admin-settings.handler';

const locale = new I18nService().getLocale(Language.EN);
const texts = locale.adminSettings;
const PAUSES = [
  [{ text: 'Pause for today', data: 'aset:today' }],
  [{ text: 'Pause until a day', data: 'aset:days' }],
  [{ text: 'Pause with no end', data: 'aset:forever' }],
];
const RESUME = [{ text: 'Resume', data: 'aset:resume' }];
const MENU = [{ text: 'Menu', data: 'adm:menu' }];
const AI_TEXT = [
  texts.aiAlways,
  `**${texts.ai.name}** — ${texts.ai.description}`,
  `**${texts.aiCommits.name}** — ${texts.aiCommits.description}`,
  `**${texts.aiComments.name}** — ${texts.aiComments.description}`,
];

function screenText(state: string, ai = [texts.aiNotConfigured]) {
  return [texts.title, state, texts.hint, '', ...ai].join('\n');
}

function settings(values: Partial<Settings>): Settings {
  return {
    id: 1,
    reportsPaused: true,
    reportsPausedUntil: null,
    aiEnabled: true,
    aiSendCommits: true,
    aiSendComments: false,
    updatedAt: new Date(),
    ...values,
  };
}

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('AdminSettingsHandler', () => {
  const repository = {
    findOne: vi.fn<SettingsRepository['findOne']>(),
    upsert: vi.fn<SettingsRepository['upsert']>(),
  };
  const aiService = { isEnabled: vi.fn<AiService['isEnabled']>() };
  const handler = new AdminSettingsHandler(
    new SettingsService(repository as unknown as SettingsRepository),
    aiService as unknown as AiService,
    { get: () => 'Asia/Almaty' } as unknown as ConfigService<AppEnvs, true>,
  );
  const open = (input: ChatInput) =>
    handler.handle({
      actor: {
        channel: Channel.TELEGRAM,
        externalId: '1',
        chatId: '1',
        language: Language.EN,
        isOwner: true,
        user: null,
      },
      locale,
      input,
      dialog: null,
    });

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: Date.parse('2026-11-10T08:00:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows that scheduled reports go and offers the pauses', async () => {
    repository.findOne.mockResolvedValue(null as unknown as Settings);

    expect(await open(button('aset:menu'))).toEqual({
      screen: {
        text: screenText(texts.reportsOn),
        buttons: [...PAUSES, MENU],
      },
      dialog: null,
    });
  });

  it('pauses for today, until a day and with no end', async () => {
    repository.findOne.mockResolvedValueOnce(settings({ reportsPausedUntil: '2026-11-10' }));
    expect(await open(button('aset:today'))).toEqual({
      screen: {
        text: screenText(texts.pausedToday),
        buttons: [...PAUSES, RESUME, MENU],
      },
      dialog: null,
    });
    expect(repository.upsert).toHaveBeenLastCalledWith({
      reportsPaused: true,
      reportsPausedUntil: '2026-11-10',
    });

    repository.findOne.mockResolvedValueOnce(settings({ reportsPausedUntil: '2026-11-20' }));
    expect((await open(button('aset:until:2026-11-20'))).screen.text).toContain(
      texts.pausedUntil('20 November'),
    );
    expect(repository.upsert).toHaveBeenLastCalledWith({
      reportsPaused: true,
      reportsPausedUntil: '2026-11-20',
    });

    repository.findOne.mockResolvedValueOnce(settings({}));
    expect((await open(button('aset:forever'))).screen.text).toContain(texts.pausedForever);
    expect(repository.upsert).toHaveBeenLastCalledWith({
      reportsPaused: true,
      reportsPausedUntil: null,
    });
  });

  it('offers the next 14 days, three in a row', async () => {
    const { screen } = await open(button('aset:days'));

    expect(screen.text).toBe(texts.chooseDay(14));
    expect(screen.buttons?.map((row) => row.length)).toEqual([3, 3, 3, 3, 2, 1]);
    expect(screen.buttons?.[0][0]).toEqual({ text: 'Wed 11 Nov', data: 'aset:until:2026-11-11' });
    expect(screen.buttons?.[4][1]).toEqual({ text: 'Tue 24 Nov', data: 'aset:until:2026-11-24' });
    expect(screen.buttons?.[5]).toEqual([{ text: 'Back', data: 'aset:menu' }]);
  });

  it('refuses a day that is not ahead or is too far', async () => {
    for (const date of ['2026-11-10', '2026-11-25']) {
      expect(await open(button(`aset:until:${date}`))).toEqual({
        screen: { text: locale.bot.expired },
      });
    }
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('resumes and treats an ended pause as none', async () => {
    repository.findOne.mockResolvedValueOnce(settings({ reportsPaused: false }));
    expect((await open(button('aset:resume'))).screen.text).toContain(texts.reportsOn);
    expect(repository.upsert).toHaveBeenCalledWith({
      reportsPaused: false,
      reportsPausedUntil: null,
    });

    repository.findOne.mockResolvedValueOnce(settings({ reportsPausedUntil: '2026-11-09' }));
    expect((await open(button('aset:menu'))).screen).toEqual({
      text: screenText(texts.reportsOn),
      buttons: [...PAUSES, MENU],
    });
  });

  it('answers a text and an outdated button', async () => {
    expect(await open({ type: ChatInputType.TEXT, text: 'pause' })).toEqual({
      screen: { text: locale.bot.unknownInput },
    });
    expect(await open(button('aset:until:soon'))).toEqual({
      screen: { text: locale.bot.expired },
    });
  });

  it('shows the AI switches with the defaults when AI is set up', async () => {
    aiService.isEnabled.mockReturnValue(true);
    repository.findOne.mockResolvedValue(null as unknown as Settings);

    expect((await open(button('aset:menu'))).screen).toEqual({
      text: screenText(texts.reportsOn, AI_TEXT),
      buttons: [
        ...PAUSES,
        [{ text: 'AI for everyone: yes', data: 'aset:ai:off' }],
        [{ text: 'Commits in AI: yes', data: 'aset:aicommits:off' }],
        [{ text: 'Comments in AI: no', data: 'aset:aicomments:on' }],
        MENU,
      ],
    });
  });

  it.each([
    ['aset:ai:off', { aiEnabled: false }, 'AI for everyone: no'],
    ['aset:aicommits:off', { aiSendCommits: false }, 'Commits in AI: no'],
    ['aset:aicomments:on', { aiSendComments: true }, 'Comments in AI: yes'],
  ])('stores the AI switch %s', async (data, update, label) => {
    aiService.isEnabled.mockReturnValue(true);
    repository.findOne.mockResolvedValue(settings({ reportsPaused: false, ...update }));

    const { screen } = await open(button(data));

    expect(repository.upsert).toHaveBeenCalledWith(update);
    expect(screen.buttons?.flat().map(({ text }) => text)).toContain(label);
  });
});
