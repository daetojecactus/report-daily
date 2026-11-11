import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import { SettingsHandler } from '../settings.handler';
import { SettingsView } from '../settings.view';

const i18nService = new I18nService();
const en = i18nService.getLocale(Language.EN);
const ru = i18nService.getLocale(Language.RU);
const FOUND = createEmployee();
const USER = FOUND.user;
const TIME_ZONE_DIALOG: BotDialog = { namespace: 'set', step: 'tz', data: {} };
const MENU_BUTTONS = [
  [
    { text: 'Language', data: 'set:lang' },
    { text: 'Report time', data: 'set:time' },
  ],
  [
    { text: 'Time zone', data: 'set:tz' },
    { text: 'Gender', data: 'set:gender' },
  ],
  [{ text: 'Scheduled report: yes', data: 'set:sched:off' }],
  [{ text: 'AI: yes', data: 'set:ai:off' }],
  [{ text: 'Data in AI: yes', data: 'set:aidata:off' }],
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
  const handler = new SettingsHandler(
    userService as unknown as UserService,
    channelService as unknown as ChannelService,
    menuService as unknown as MenuService,
    i18nService,
    new SettingsView({ get: () => 'Asia/Almaty' } as unknown as ConfigService<AppEnvs, true>),
    [{ channel: Channel.TELEGRAM }, { channel: Channel.SLACK }] as ChatChannel[],
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
    channelService.findByUser.mockResolvedValue([FOUND.channel]);
    channelService.findBound.mockResolvedValue([FOUND.channel]);
  });

  it('shows the current settings on /settings', async () => {
    expect(await open({ type: ChatInputType.COMMAND, command: 'settings' })).toEqual({
      screen: {
        text: [
          '**My settings**',
          'Language: English',
          'Report time: 18:00',
          'Time zone: `Asia/Almaty`, default',
          'Gender: male',
          '',
          '**Scheduled report** — send the report automatically at your time on days with actions; `/report` always works',
          '**AI** — improve the wording of report lines with AI',
          '**Data in AI** — send the titles of my commits and excerpts of my comments to AI',
        ].join('\n'),
        buttons: MENU_BUTTONS,
      },
      dialog: null,
    });
  });

  it('switches the language, the screen and the menu', async () => {
    const updated = { ...USER, language: Language.RU };
    userService.updateSettings.mockResolvedValue(updated);

    const { screen } = await open(button('set:lang:ru'));

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, {
      language: Language.RU,
    });
    expect(menuService.syncEmployee).toHaveBeenCalledWith(updated, [FOUND.channel]);
    expect(screen.text.split('\n').slice(0, 2)).toEqual([ru.settings.title, 'Язык: Русский']);
  });

  it('offers the languages', async () => {
    expect((await open(button('set:lang'))).screen.buttons).toEqual([
      [{ text: 'Русский', data: 'set:lang:ru' }],
      [{ text: 'English', data: 'set:lang:en' }],
      [{ text: 'Back', data: 'set:menu' }],
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

  it('saves the report time', async () => {
    userService.updateSettings.mockResolvedValue({
      ...USER,
      reportTime: '09:30:00',
    });

    const { screen } = await open(button('set:time:09:30'));

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, {
      reportTime: '09:30',
    });
    expect(screen.text).toContain('Report time: 09:30');
  });

  it('asks for a time zone in a dialog', async () => {
    expect(await open(button('set:tz'))).toEqual({
      screen: {
        text: en.settings.timeZonePrompt('`Asia/Almaty`, default'),
        buttons: [
          [{ text: 'Default: Asia/Almaty', data: 'set:tz:default' }],
          [{ text: 'Back', data: 'set:menu' }],
        ],
      },
      dialog: TIME_ZONE_DIALOG,
    });
  });

  it('saves a typed time zone in its canonical form', async () => {
    userService.updateSettings.mockResolvedValue({
      ...USER,
      timezone: 'Europe/Moscow',
    });

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

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, {
      timezone: null,
    });
  });

  it('shows the switched off values with the buttons to switch them on', async () => {
    const { screen } = await open({ type: ChatInputType.COMMAND, command: 'settings' }, null, {
      ...USER,
      scheduleEnabled: false,
      aiEnabled: false,
      aiDataOptOut: true,
    });

    expect(screen.buttons?.slice(2)).toEqual([
      [{ text: 'Scheduled report: no', data: 'set:sched:on' }],
      [{ text: 'AI: no', data: 'set:ai:on' }],
      [{ text: 'Data in AI: no', data: 'set:aidata:on' }],
      [{ text: 'Report template', data: 'tpl:menu' }],
    ]);
  });

  it.each<[string, UserSettingsUpdate]>([
    ['set:sched:off', { scheduleEnabled: false }],
    ['set:sched:on', { scheduleEnabled: true }],
    ['set:ai:off', { aiEnabled: false }],
    ['set:ai:on', { aiEnabled: true }],
    ['set:aidata:off', { aiDataOptOut: true }],
    ['set:aidata:on', { aiDataOptOut: false }],
  ])('stores the switch %s', async (data, update) => {
    userService.updateSettings.mockResolvedValue({ ...USER, ...update });

    const { screen } = await open(button(data));

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, update);
    expect(screen.text.split('\n')[0]).toBe(en.settings.title);
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
          [{ text: 'Back', data: 'set:menu' }],
        ],
      },
      dialog: null,
    });
  });

  it('saves the gender', async () => {
    userService.updateSettings.mockResolvedValue({
      ...USER,
      gender: Gender.FEMALE,
    });

    const { screen } = await open(button('set:gender:female'));

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, {
      gender: Gender.FEMALE,
    });
    expect(screen.text).toContain('Gender: female');
  });

  it.each([
    'set:time:24',
    'set:time:09:10',
    'set:lang:de',
    'set:tz:moscow',
    'set:ai',
    'set:aidata:yes',
    'set:gender:other',
    'set:preset',
    'set:empty:off',
    'set:leave',
    'set:other',
  ])('answers the outdated button %s', async (data) => {
    expect((await open(button(data))).screen).toEqual({
      text: en.bot.expired,
    });
  });

  describe('with Telegram and Slack', () => {
    const SLACK = { ...FOUND.channel, channel: Channel.SLACK, externalId: 'U0ANNA01' };
    const CHANNELS_LINE = `**${en.settings.channels.name}** — ${en.settings.channels.description}`;

    it('shows a switch for each channel', async () => {
      channelService.findBound.mockResolvedValue([FOUND.channel, SLACK]);

      const { screen } = await open({ type: ChatInputType.COMMAND, command: 'settings' });

      expect(channelService.findBound).toHaveBeenCalledWith(USER.id, [
        Channel.TELEGRAM,
        Channel.SLACK,
      ]);
      expect(screen.text).toContain(CHANNELS_LINE);
      expect(screen.buttons).toContainEqual([
        { text: 'Telegram: yes', data: 'set:recv:telegram:off' },
        { text: 'Slack: yes', data: 'set:recv:slack:off' },
      ]);
    });

    it('hides the channels with only one channel', async () => {
      const { screen } = await open({ type: ChatInputType.COMMAND, command: 'settings' });

      expect(screen.text).not.toContain(CHANNELS_LINE);
      expect(screen.buttons).toEqual(MENU_BUTTONS);
    });

    it('switches a channel off and on again', async () => {
      channelService.findBound.mockResolvedValue([FOUND.channel, SLACK]);

      await open(button('set:recv:slack:off'));
      expect(channelService.updateReceiving).toHaveBeenLastCalledWith(
        USER.id,
        [Channel.TELEGRAM, Channel.SLACK],
        [Channel.TELEGRAM],
      );

      channelService.findBound.mockResolvedValue([FOUND.channel, { ...SLACK, receives: false }]);
      await open(button('set:recv:slack:on'));
      expect(channelService.updateReceiving).toHaveBeenLastCalledWith(
        USER.id,
        [Channel.TELEGRAM, Channel.SLACK],
        [Channel.TELEGRAM, Channel.SLACK],
      );
    });

    it('keeps the last channel on', async () => {
      channelService.findBound.mockResolvedValue([FOUND.channel, { ...SLACK, receives: false }]);

      const { screen } = await open(button('set:recv:telegram:off'));

      expect(channelService.updateReceiving).not.toHaveBeenCalled();
      expect(screen.text.startsWith(`${en.settings.lastChannel}\n\n**My settings**`)).toBe(true);
      expect(screen.buttons).toContainEqual([
        { text: 'Telegram: yes', data: 'set:recv:telegram:off' },
        { text: 'Slack: no', data: 'set:recv:slack:on' },
      ]);
    });

    it('treats every channel as on when none is', async () => {
      channelService.findBound.mockResolvedValue([
        { ...FOUND.channel, receives: false },
        { ...SLACK, receives: false },
      ]);

      await open(button('set:recv:telegram:off'));

      expect(channelService.updateReceiving).toHaveBeenCalledWith(
        USER.id,
        [Channel.TELEGRAM, Channel.SLACK],
        [Channel.SLACK],
      );
    });

    it('ignores a switch of a channel the employee does not have', async () => {
      await open(button('set:recv:slack:off'));

      expect(channelService.updateReceiving).not.toHaveBeenCalled();
    });
  });
});
