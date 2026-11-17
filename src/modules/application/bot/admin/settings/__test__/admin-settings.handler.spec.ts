import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenButtonStyle } from 'src/common/channel/types/screen.enums';
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
import { AdminSettingsView } from '../admin-settings.view';

const locale = new I18nService().getLocale(Language.EN);
const texts = locale.adminSettings;
const PAUSE_ROW = [{ text: 'Pause of reports', data: 'aset:pause' }];
const BACK_TO_ADMIN = [{ text: 'Menu', data: 'adm:menu' }];
const PAUSES = [
  { text: 'For today', data: 'aset:today' },
  { text: 'Until a day', data: 'aset:days' },
  { text: 'No end', data: 'aset:forever' },
];
const BACK_TO_SETTINGS = [{ text: 'Back', data: 'aset:menu' }];

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
    new AdminSettingsView(),
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

  it('shows the overview without AI while AI is not set up', async () => {
    repository.findOne.mockResolvedValue(null as unknown as Settings);

    expect(await open(button('aset:menu'))).toEqual({
      screen: {
        text: ['**Settings**', 'Scheduled reports: on', 'AI: not set up'].join('\n'),
        buttons: [PAUSE_ROW, BACK_TO_ADMIN],
      },
      dialog: null,
    });
  });

  it('shows the overview with the AI switches when AI is set up', async () => {
    aiService.isEnabled.mockReturnValue(true);
    repository.findOne.mockResolvedValue(null as unknown as Settings);

    expect((await open(button('aset:menu'))).screen).toEqual({
      text: [
        '**Settings**',
        'Scheduled reports: on',
        'AI for everyone: yes',
        'Commits in AI: yes',
        'Comments in AI: no',
      ].join('\n'),
      buttons: [
        PAUSE_ROW,
        [{ text: 'AI for everyone', data: 'aset:ai:off' }],
        [{ text: 'Commits in AI', data: 'aset:aicommits:off' }],
        [{ text: 'Comments in AI', data: 'aset:aicomments:on' }],
        BACK_TO_ADMIN,
      ],
    });
  });

  it('shows the pauses with the state and a resume only during a pause', async () => {
    repository.findOne.mockResolvedValueOnce(settings({ reportsPaused: false }));
    expect((await open(button('aset:pause'))).screen).toEqual({
      text: ['**Pause of reports**', texts.pauseHint, 'Now: on'].join('\n'),
      buttons: [PAUSES, BACK_TO_SETTINGS],
    });

    repository.findOne.mockResolvedValueOnce(settings({ reportsPausedUntil: '2026-11-20' }));
    expect((await open(button('aset:pause'))).screen).toEqual({
      text: ['**Pause of reports**', texts.pauseHint, 'Now: paused through 20 November'].join('\n'),
      buttons: [PAUSES, [{ text: 'Resume', data: 'aset:resume' }], BACK_TO_SETTINGS],
    });
  });

  it.each([
    ['aset:today', texts.confirmToday, 'Pause', ScreenButtonStyle.DANGER],
    ['aset:forever', texts.confirmForever, 'Pause', ScreenButtonStyle.DANGER],
    ['aset:resume', texts.confirmResume, 'Resume', ScreenButtonStyle.PRIMARY],
  ])('asks before %s', async (data, description, action, style) => {
    expect((await open(button(data))).screen).toEqual({
      text: ['**Pause of reports**', description].join('\n'),
      buttons: [
        [
          { text: action, data: `${data}:ok`, style },
          { text: 'Back', data: 'aset:pause' },
        ],
      ],
    });
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('pauses for today, until a day and with no end once confirmed', async () => {
    repository.findOne.mockResolvedValueOnce(settings({ reportsPausedUntil: '2026-11-10' }));
    expect((await open(button('aset:today:ok'))).screen.text).toContain('Now: paused for today');
    expect(repository.upsert).toHaveBeenLastCalledWith({
      reportsPaused: true,
      reportsPausedUntil: '2026-11-10',
    });

    repository.findOne.mockResolvedValueOnce(settings({ reportsPausedUntil: '2026-11-20' }));
    expect((await open(button('aset:until:2026-11-20'))).screen.text).toContain(
      'Now: paused through 20 November',
    );
    expect(repository.upsert).toHaveBeenLastCalledWith({
      reportsPaused: true,
      reportsPausedUntil: '2026-11-20',
    });

    repository.findOne.mockResolvedValueOnce(settings({}));
    expect((await open(button('aset:forever:ok'))).screen.text).toContain(
      'Now: paused with no end',
    );
    expect(repository.upsert).toHaveBeenLastCalledWith({
      reportsPaused: true,
      reportsPausedUntil: null,
    });
  });

  it('offers the next 14 days, three in a row, with a way back to the pauses', async () => {
    const { screen } = await open(button('aset:days'));

    expect(screen.text).toBe(texts.chooseDay(14));
    expect(screen.buttons?.map((row) => row.length)).toEqual([3, 3, 3, 3, 2, 1]);
    expect(screen.buttons?.[0][0]).toEqual({ text: 'Wed 11 Nov', data: 'aset:until:2026-11-11' });
    expect(screen.buttons?.[4][1]).toEqual({ text: 'Tue 24 Nov', data: 'aset:until:2026-11-24' });
    expect(screen.buttons?.[5]).toEqual([{ text: 'Back', data: 'aset:pause' }]);
  });

  it('refuses a day that is not ahead or is too far', async () => {
    for (const date of ['2026-11-10', '2026-11-25']) {
      expect(await open(button(`aset:until:${date}`))).toEqual({
        screen: { text: locale.bot.expired },
      });
    }
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('resumes once confirmed and treats an ended pause as none', async () => {
    repository.findOne.mockResolvedValueOnce(settings({ reportsPaused: false }));
    expect((await open(button('aset:resume:ok'))).screen.text).toContain('Now: on');
    expect(repository.upsert).toHaveBeenCalledWith({
      reportsPaused: false,
      reportsPausedUntil: null,
    });

    repository.findOne.mockResolvedValueOnce(settings({ reportsPausedUntil: '2026-11-09' }));
    expect((await open(button('aset:menu'))).screen.text).toContain('Scheduled reports: on');
  });

  it('answers a text and an outdated button', async () => {
    expect(await open({ type: ChatInputType.TEXT, text: 'pause' })).toEqual({
      screen: { text: locale.bot.unknownInput },
    });
    for (const data of ['aset:until:soon', 'aset:today:yes', 'aset:ai:maybe']) {
      expect(await open(button(data))).toEqual({ screen: { text: locale.bot.expired } });
    }
  });

  it('refuses an AI switch while AI is not set up', async () => {
    aiService.isEnabled.mockReturnValue(false);

    expect(await open(button('aset:ai:off:ok'))).toEqual({
      screen: { text: locale.bot.expired },
    });
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('asks before an AI switch', async () => {
    aiService.isEnabled.mockReturnValue(true);

    expect((await open(button('aset:aicomments:on'))).screen).toEqual({
      text: ['**Comments in AI**', texts.aiComments.description, 'Now: no'].join('\n'),
      buttons: [
        [
          { text: 'Turn on', data: 'aset:aicomments:on:ok', style: ScreenButtonStyle.PRIMARY },
          { text: 'Back', data: 'aset:menu' },
        ],
      ],
    });
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['aset:ai:off:ok', { aiEnabled: false }, 'AI for everyone: no'],
    ['aset:aicommits:off:ok', { aiSendCommits: false }, 'Commits in AI: no'],
    ['aset:aicomments:on:ok', { aiSendComments: true }, 'Comments in AI: yes'],
  ])('stores the confirmed AI switch %s', async (data, update, line) => {
    aiService.isEnabled.mockReturnValue(true);
    repository.findOne.mockResolvedValue(settings({ reportsPaused: false, ...update }));

    const { screen } = await open(button(data));

    expect(repository.upsert).toHaveBeenCalledWith(update);
    expect(screen.text).toContain(line);
  });
});
