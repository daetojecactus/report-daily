import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenButtonStyle } from 'src/common/channel/types/screen.enums';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatChannel, ChatInput } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { UserChannel } from 'src/modules/application/user/channel/types/channel.interface';
import type { ChannelRepository } from 'src/modules/application/user/channel/channel.repository';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { Gender } from 'src/modules/application/user/types/user.enums';
import type { User, UserSettingsUpdate } from 'src/modules/application/user/types/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import type { BotDialog } from '../../core/types/bot.interface';
import type { MenuService } from '../../core/menu.service';
import { createEmployee } from '../../__test__/bot.fixture';
import type { AiService } from 'src/modules/application/ai/ai.service';
import type { TemplateService } from 'src/modules/application/report/template/template.service';
import { TemplatesView } from '../../templates/templates.view';
import { SettingsHandler } from '../settings.handler';
import { SettingsView } from '../settings.view';

const i18nService = new I18nService();
const en = i18nService.getLocale(Language.EN);
const ru = i18nService.getLocale(Language.RU);
const FOUND = createEmployee();
const USER = FOUND.user;
const TIME_ZONE_DIALOG: BotDialog = { namespace: 'set', step: 'tz', data: {} };
const COMMAND: ChatInput = { type: ChatInputType.COMMAND, command: 'settings' };
const MENU_BUTTONS = [
  [{ text: 'General', data: 'set:general' }],
  [{ text: 'Reports and AI', data: 'set:reports' }],
  [{ text: 'Report template', data: 'tpl:menu' }],
];

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('SettingsHandler', () => {
  const userService = {
    updateSettings: vi.fn<(id: string, update: UserSettingsUpdate) => Promise<User | null>>(),
  };
  const channels = new ChannelService({} as ChannelRepository);
  const channelService = {
    findByUser: vi.fn<(userId: string) => Promise<UserChannel[]>>(),
    findBound: vi.fn<ChannelService['findBound']>(),
    updateReceiving: vi.fn<ChannelService['updateReceiving']>(),
    toReceiving: (bound: UserChannel[]) => channels.toReceiving(bound),
  };
  const menuService = { syncEmployee: vi.fn() };
  const aiService = { isEnabled: vi.fn<AiService['isEnabled']>(() => true) };
  const templateService = { findAvailable: vi.fn<TemplateService['findAvailable']>() };
  const handler = new SettingsHandler(
    userService as unknown as UserService,
    channelService as unknown as ChannelService,
    menuService as unknown as MenuService,
    i18nService,
    new SettingsView({ get: () => 'Asia/Almaty' } as unknown as ConfigService<AppEnvs, true>),
    [{ channel: Channel.TELEGRAM }, { channel: Channel.SLACK }] as ChatChannel[],
    aiService as unknown as AiService,
    templateService as unknown as TemplateService,
    new TemplatesView(),
  );

  function open(input: ChatInput, dialog: BotDialog | null = null, user: User | null = USER) {
    return handler.handle({
      actor: {
        channel: Channel.TELEGRAM,
        externalId: '1',
        chatId: '1',
        language: Language.EN,
        isOwner: false,
        user,
      },
      locale: en,
      input,
      dialog,
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    aiService.isEnabled.mockReturnValue(true);
    templateService.findAvailable.mockResolvedValue([]);
    channelService.findByUser.mockResolvedValue([FOUND.channel]);
    channelService.findBound.mockResolvedValue([FOUND.channel]);
  });

  it('opens the overview of the settings with the sections on /settings', async () => {
    expect(await open(COMMAND)).toEqual({
      screen: {
        text: [
          '**Settings**',
          'Language: English',
          'Report time: 18:00',
          'Time zone: `Asia/Almaty`, default',
          'Gender: male',
          '',
          'Scheduled report: yes',
          'AI: yes',
          'Data in AI: yes',
          '',
          'Delivery channels: Telegram',
          'Report template: Standard',
        ].join('\n'),
        buttons: MENU_BUTTONS,
      },
      dialog: null,
    });
  });

  it('names the chosen template and the receiving channels in the overview', async () => {
    const SLACK = { ...FOUND.channel, channel: Channel.SLACK, externalId: 'U0ANNA01' };
    channelService.findBound.mockResolvedValue([FOUND.channel, SLACK]);
    templateService.findAvailable.mockResolvedValue([
      { id: 'template-1', name: 'Weekly', ownerId: null },
    ] as Awaited<ReturnType<TemplateService['findAvailable']>>);

    const { screen } = await open(COMMAND, null, { ...USER, templateId: 'template-1' });

    expect(screen.text).toContain('Delivery channels: Telegram, Slack');
    expect(screen.text).toContain('Report template: Weekly (shared)');
  });

  it('shows the general settings with their values and a way back', async () => {
    expect(await open(button('set:general'))).toEqual({
      screen: {
        text: [
          '**General**',
          'Language: English',
          'Report time: 18:00',
          'Time zone: `Asia/Almaty`, default',
          'Gender: male',
        ].join('\n'),
        buttons: [
          [
            { text: 'Language', data: 'set:lang' },
            { text: 'Report time', data: 'set:time' },
          ],
          [
            { text: 'Time zone', data: 'set:tz' },
            { text: 'Gender', data: 'set:gender' },
          ],
          [{ text: 'Back', data: 'set:menu' }],
        ],
      },
      dialog: null,
    });
  });

  it('shows the report switches with their values', async () => {
    expect(
      await open(button('set:reports'), null, { ...USER, aiEnabled: false, aiDataOptOut: true }),
    ).toEqual({
      screen: {
        text: ['**Reports and AI**', 'Scheduled report: yes', 'AI: no', 'Data in AI: no'].join(
          '\n',
        ),
        buttons: [
          [{ text: 'Scheduled report', data: 'set:sched:off' }],
          [{ text: 'AI', data: 'set:ai:on' }],
          [{ text: 'Data in AI', data: 'set:aidata:on' }],
          [{ text: 'Back', data: 'set:menu' }],
        ],
      },
      dialog: null,
    });
  });

  it('shows no AI switches and refuses them while AI is not set up', async () => {
    aiService.isEnabled.mockReturnValue(false);

    expect((await open(COMMAND)).screen.buttons?.[1]).toEqual([
      { text: 'Reports', data: 'set:reports' },
    ]);
    expect((await open(button('set:reports'))).screen.text).toBe(
      ['**Reports**', 'Scheduled report: yes'].join('\n'),
    );
    expect(await open(button('set:ai:off:ok'))).toEqual({ screen: { text: en.bot.expired } });
    expect(await open(button('set:aidata:off'))).toEqual({ screen: { text: en.bot.expired } });
    expect(userService.updateSettings).not.toHaveBeenCalled();
  });

  it('asks before a switch and stores it only when confirmed', async () => {
    expect(await open(button('set:ai:off'))).toEqual({
      screen: {
        text: ['**AI**', en.settings.ai.description, 'Now: yes'].join('\n'),
        buttons: [
          [
            { text: 'Turn off', data: 'set:ai:off:ok', style: ScreenButtonStyle.DANGER },
            { text: 'Back', data: 'set:reports' },
          ],
        ],
      },
      dialog: null,
    });
    expect(userService.updateSettings).not.toHaveBeenCalled();
  });

  it.each<[string, UserSettingsUpdate]>([
    ['set:sched:off:ok', { scheduleEnabled: false }],
    ['set:sched:on:ok', { scheduleEnabled: true }],
    ['set:ai:off:ok', { aiEnabled: false }],
    ['set:ai:on:ok', { aiEnabled: true }],
    ['set:aidata:off:ok', { aiDataOptOut: true }],
    ['set:aidata:on:ok', { aiDataOptOut: false }],
  ])('stores the confirmed switch %s and returns to the reports', async (data, update) => {
    userService.updateSettings.mockResolvedValue({ ...USER, ...update });

    const { screen } = await open(button(data));

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, update);
    expect(screen.text.split('\n')[0]).toBe('**Reports and AI**');
  });

  it('switches the language, the screen and the menu', async () => {
    const updated = { ...USER, language: Language.RU };
    userService.updateSettings.mockResolvedValue(updated);

    const { screen } = await open(button('set:lang:ru'));

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, {
      language: Language.RU,
    });
    expect(menuService.syncEmployee).toHaveBeenCalledWith(updated, [FOUND.channel]);
    expect(screen.text.split('\n').slice(0, 2)).toEqual([
      `**${ru.settings.general}**`,
      'Язык: Русский',
    ]);
  });

  it('offers the languages with a way back to the general settings', async () => {
    expect((await open(button('set:lang'))).screen.buttons).toEqual([
      [{ text: 'Русский', data: 'set:lang:ru' }],
      [{ text: 'English', data: 'set:lang:en' }],
      [{ text: 'Back', data: 'set:general' }],
    ]);
  });

  it('offers the hours in rows of six', async () => {
    const { screen } = await open(button('set:time'));

    expect(screen.text).toBe(en.settings.chooseHour('`Asia/Almaty`, default'));
    expect(screen.buttons).toHaveLength(5);
    expect(screen.buttons?.[3]).toEqual(
      ['18', '19', '20', '21', '22', '23'].map((hour) => ({
        text: hour,
        data: `set:time:${hour}`,
      })),
    );
    expect(screen.buttons?.[4]).toEqual([{ text: 'Back', data: 'set:general' }]);
  });

  it('offers the minutes of an hour', async () => {
    expect((await open(button('set:time:09'))).screen.buttons).toEqual([
      ['00', '15', '30', '45'].map((minute) => ({
        text: `09:${minute}`,
        data: `set:time:09:${minute}`,
      })),
      [{ text: 'Back', data: 'set:time' }],
    ]);
  });

  it('saves the report time and returns to the general settings', async () => {
    userService.updateSettings.mockResolvedValue({ ...USER, reportTime: '09:30:00' });

    const { screen } = await open(button('set:time:09:30'));

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, { reportTime: '09:30' });
    expect(screen.text).toContain('Report time: 09:30');
  });

  it('asks for a time zone in a dialog', async () => {
    expect(await open(button('set:tz'))).toEqual({
      screen: {
        text: en.settings.timeZonePrompt('`Asia/Almaty`, default'),
        buttons: [
          [{ text: 'Default: Asia/Almaty', data: 'set:tz:default' }],
          [{ text: 'Back', data: 'set:general' }],
        ],
      },
      dialog: TIME_ZONE_DIALOG,
    });
  });

  it('saves a typed time zone in its canonical form', async () => {
    userService.updateSettings.mockResolvedValue({ ...USER, timezone: 'Europe/Moscow' });

    const reply = await open(
      { type: ChatInputType.TEXT, text: ' europe/moscow ' },
      TIME_ZONE_DIALOG,
    );

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, {
      timezone: 'Europe/Moscow',
    });
    expect(reply.screen.text).toContain('Time zone: `Europe/Moscow`');
    expect(reply.dialog).toBeNull();
  });

  it('asks again for an unknown time zone', async () => {
    const reply = await open({ type: ChatInputType.TEXT, text: 'Moscow time' }, TIME_ZONE_DIALOG);

    expect(userService.updateSettings).not.toHaveBeenCalled();
    expect(reply.screen.text).toBe(en.settings.timeZoneInvalid);
    expect(reply.dialog).toEqual(TIME_ZONE_DIALOG);
  });

  it('resets the time zone to the default', async () => {
    userService.updateSettings.mockResolvedValue(USER);

    await open(button('set:tz:default'));

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, { timezone: null });
  });

  it('offers the genders', async () => {
    expect(await open(button('set:gender'))).toEqual({
      screen: {
        text: en.settings.chooseGender,
        buttons: [
          [
            { text: 'male', data: 'set:gender:male' },
            { text: 'female', data: 'set:gender:female' },
          ],
          [{ text: 'Back', data: 'set:general' }],
        ],
      },
      dialog: null,
    });
  });

  it('saves the gender', async () => {
    userService.updateSettings.mockResolvedValue({ ...USER, gender: Gender.FEMALE });

    const { screen } = await open(button('set:gender:female'));

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, { gender: Gender.FEMALE });
    expect(screen.text).toContain('Gender: female');
  });

  it.each([
    'set:time:24',
    'set:time:09:10',
    'set:lang:de',
    'set:tz:moscow',
    'set:ai',
    'set:aidata:yes',
    'set:ai:off:yes',
    'set:gender:other',
    'set:preset',
    'set:empty:off',
    'set:leave',
    'set:other',
  ])('answers the outdated button %s', async (data) => {
    expect((await open(button(data))).screen).toEqual({ text: en.bot.expired });
  });

  describe('with Telegram and Slack', () => {
    const SLACK = { ...FOUND.channel, channel: Channel.SLACK, externalId: 'U0ANNA01' };

    it('offers the delivery channels only with two of them', async () => {
      expect((await open(COMMAND)).screen.buttons).toEqual(MENU_BUTTONS);

      channelService.findBound.mockResolvedValue([FOUND.channel, SLACK]);
      expect((await open(COMMAND)).screen.buttons).toContainEqual([
        { text: 'Delivery channels', data: 'set:channels' },
      ]);
      expect(channelService.findBound).toHaveBeenCalledWith(USER.id, [
        Channel.TELEGRAM,
        Channel.SLACK,
      ]);
    });

    it('shows each channel with its value', async () => {
      channelService.findBound.mockResolvedValue([FOUND.channel, { ...SLACK, receives: false }]);

      expect((await open(button('set:channels'))).screen).toEqual({
        text: ['**Delivery channels**', 'Telegram: yes', 'Slack: no'].join('\n'),
        buttons: [
          [
            { text: 'Telegram', data: 'set:recv:telegram:off' },
            { text: 'Slack', data: 'set:recv:slack:on' },
          ],
          [{ text: 'Back', data: 'set:menu' }],
        ],
      });
    });

    it('asks before switching a channel', async () => {
      channelService.findBound.mockResolvedValue([FOUND.channel, SLACK]);

      expect((await open(button('set:recv:slack:off'))).screen).toEqual({
        text: ['**Slack**', en.settings.channelDescription, 'Now: yes'].join('\n'),
        buttons: [
          [
            { text: 'Turn off', data: 'set:recv:slack:off:ok', style: ScreenButtonStyle.DANGER },
            { text: 'Back', data: 'set:channels' },
          ],
        ],
      });
      expect(channelService.updateReceiving).not.toHaveBeenCalled();
    });

    it('switches a channel off and on again', async () => {
      channelService.findBound.mockResolvedValue([FOUND.channel, SLACK]);

      await open(button('set:recv:slack:off:ok'));
      expect(channelService.updateReceiving).toHaveBeenLastCalledWith(
        USER.id,
        [Channel.TELEGRAM, Channel.SLACK],
        [Channel.TELEGRAM],
      );

      channelService.findBound.mockResolvedValue([FOUND.channel, { ...SLACK, receives: false }]);
      await open(button('set:recv:slack:on:ok'));
      expect(channelService.updateReceiving).toHaveBeenLastCalledWith(
        USER.id,
        [Channel.TELEGRAM, Channel.SLACK],
        [Channel.TELEGRAM, Channel.SLACK],
      );
    });

    it('keeps the last channel on', async () => {
      channelService.findBound.mockResolvedValue([FOUND.channel, { ...SLACK, receives: false }]);

      const { screen } = await open(button('set:recv:telegram:off:ok'));

      expect(channelService.updateReceiving).not.toHaveBeenCalled();
      expect(screen.text.startsWith(`**Delivery channels**\n${en.settings.lastChannel}\n\n`)).toBe(
        true,
      );
    });

    it('treats every channel as on when none is', async () => {
      channelService.findBound.mockResolvedValue([
        { ...FOUND.channel, receives: false },
        { ...SLACK, receives: false },
      ]);

      await open(button('set:recv:telegram:off:ok'));

      expect(channelService.updateReceiving).toHaveBeenCalledWith(
        USER.id,
        [Channel.TELEGRAM, Channel.SLACK],
        [Channel.SLACK],
      );
    });

    it('ignores a switch of a channel the employee does not have', async () => {
      await open(button('set:recv:slack:off:ok'));

      expect(channelService.updateReceiving).not.toHaveBeenCalled();
    });
  });
});
