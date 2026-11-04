import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import type { ChatInput } from 'src/common/interfaces/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { ReportPreset } from 'src/modules/application/report/report.enums';
import type { UserChannel } from 'src/modules/application/user/channel/channel.interface';
import type { ChannelService } from 'src/modules/application/user/channel/channel.service';
import {
  Gender,
  JobRole,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import type {
  User,
  UserSettingsUpdate,
} from 'src/modules/application/user/user.interface';
import type { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import type { BotDialog } from '../../bot.interface';
import type { MenuService } from '../../menu/menu.service';
import { createEmployee } from '../../__test__/bot.fixture';
import { SettingsHandler } from '../settings.handler';

const i18nService = new I18nService();
const en = i18nService.getLocale(Language.EN);
const ru = i18nService.getLocale(Language.RU);
const FOUND = createEmployee();
const USER = FOUND.user;
const TIME_ZONE_DIALOG: BotDialog = { namespace: 'set', step: 'tz', data: {} };
const LEAVE_DIALOG: BotDialog = { namespace: 'set', step: 'leave', data: {} };
const NOW = new Date('2026-11-04T10:00:00Z');
const ON_LEAVE = {
  ...USER,
  status: UserStatus.ON_LEAVE,
  onLeaveUntil: '2026-11-15',
};
const MENU_BUTTONS = [
  [
    { text: 'Language', data: 'set:lang' },
    { text: 'Report time', data: 'set:time' },
  ],
  [
    { text: 'Time zone', data: 'set:tz' },
    { text: 'Report preset', data: 'set:preset' },
  ],
  [
    { text: 'Gender', data: 'set:gender' },
    { text: 'Vacation', data: 'set:leave' },
  ],
  [{ text: 'AI: yes', data: 'set:ai:off' }],
  [{ text: 'Data in AI: yes', data: 'set:aidata:off' }],
  [{ text: 'Empty day: yes', data: 'set:empty:off' }],
];

function button(data: string): ChatInput {
  return { type: ChatInputType.BUTTON, data, messageId: '1', callbackId: '1' };
}

describe('SettingsHandler', () => {
  const userService = {
    updateSettings:
      vi.fn<(id: string, update: UserSettingsUpdate) => Promise<User | null>>(),
    startLeave:
      vi.fn<(id: string, until: string | null) => Promise<User | null>>(),
    endLeave: vi.fn<(id: string) => Promise<User | null>>(),
  };
  const channelService = {
    findByUser: vi.fn<(userId: string) => Promise<UserChannel[]>>(),
  };
  const menuService = { syncEmployee: vi.fn() };
  const handler = new SettingsHandler(
    { get: () => 'Asia/Almaty' } as unknown as ConfigService<AppEnvs, true>,
    userService as unknown as UserService,
    channelService as unknown as ChannelService,
    menuService as unknown as MenuService,
    i18nService,
  );

  function open(
    input: ChatInput,
    dialog: BotDialog | null = null,
    user: User | null = USER,
  ) {
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
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    channelService.findByUser.mockResolvedValue([FOUND.channel]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the current settings on /settings', async () => {
    expect(
      await open({ type: ChatInputType.COMMAND, command: 'settings' }),
    ).toEqual({
      screen: {
        text: [
          '**My settings**',
          'Language: English',
          'Report time: 18:00',
          'Time zone: `Asia/Almaty`, default',
          'Report preset: by role (Standard)',
          'Gender: male',
          'Vacation: no',
          '',
          '**AI** — improve the wording of report lines with AI',
          '**Data in AI** — send the titles of my commits and excerpts of my comments to AI',
          '**Empty day** — send a message when a day had no activity',
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
    expect(menuService.syncEmployee).toHaveBeenCalledWith(updated, [
      FOUND.channel,
    ]);
    expect(screen.text.split('\n').slice(0, 2)).toEqual([
      ru.settings.title,
      'Язык: Русский',
    ]);
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
    const reply = await open(
      { type: ChatInputType.TEXT, text: 'Moscow time' },
      TIME_ZONE_DIALOG,
    );

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
    const { screen } = await open(
      { type: ChatInputType.COMMAND, command: 'settings' },
      null,
      { ...USER, aiEnabled: false, aiDataOptOut: true, notifyEmpty: false },
    );

    expect(screen.buttons?.slice(3)).toEqual([
      [{ text: 'AI: no', data: 'set:ai:on' }],
      [{ text: 'Data in AI: no', data: 'set:aidata:on' }],
      [{ text: 'Empty day: no', data: 'set:empty:on' }],
    ]);
  });

  it.each<[string, UserSettingsUpdate]>([
    ['set:ai:off', { aiEnabled: false }],
    ['set:ai:on', { aiEnabled: true }],
    ['set:aidata:off', { aiDataOptOut: true }],
    ['set:aidata:on', { aiDataOptOut: false }],
    ['set:empty:off', { notifyEmpty: false }],
    ['set:empty:on', { notifyEmpty: true }],
  ])('stores the switch %s', async (data, update) => {
    userService.updateSettings.mockResolvedValue({ ...USER, ...update });

    const { screen } = await open(button(data));

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, update);
    expect(screen.text.split('\n')[0]).toBe(en.settings.title);
  });

  it('offers the presets with the default of the role', async () => {
    expect(
      await open(button('set:preset'), null, { ...USER, role: JobRole.QA }),
    ).toEqual({
      screen: {
        text: [
          'Choose the report preset. Now: by role (QA).',
          '',
          '**Standard** — lines grouped by projects',
          '**QA** — sections: returns, testing, verified, bugs, autotests, other',
          '**Analyst** — like standard, but every line links to the issue or MR',
        ].join('\n'),
        buttons: [
          [{ text: 'By role (QA)', data: 'set:preset:role' }],
          [
            { text: 'Standard', data: 'set:preset:standard' },
            { text: 'QA', data: 'set:preset:qa' },
            { text: 'Analyst', data: 'set:preset:analyst' },
          ],
          [{ text: 'Back', data: 'set:menu' }],
        ],
      },
      dialog: null,
    });
  });

  it('saves a chosen preset', async () => {
    userService.updateSettings.mockResolvedValue({
      ...USER,
      preset: ReportPreset.ANALYST,
    });

    const { screen } = await open(button('set:preset:analyst'));

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, {
      preset: ReportPreset.ANALYST,
    });
    expect(screen.text).toContain('Report preset: Analyst\n');
  });

  it('returns to the preset of the role', async () => {
    userService.updateSettings.mockResolvedValue(USER);

    const { screen } = await open(button('set:preset:role'), null, {
      ...USER,
      preset: ReportPreset.QA,
    });

    expect(userService.updateSettings).toHaveBeenCalledWith(USER.id, {
      preset: null,
    });
    expect(screen.text).toContain('Report preset: by role (Standard)');
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

  it('asks for the last day of a vacation in a dialog', async () => {
    expect(await open(button('set:leave'))).toEqual({
      screen: {
        text: en.settings.leavePrompt('no'),
        buttons: [
          [{ text: 'No end date', data: 'set:leave:nodate' }],
          [{ text: 'Back', data: 'set:menu' }],
        ],
      },
      dialog: LEAVE_DIALOG,
    });
  });

  it('offers to end the vacation while on it', async () => {
    const { screen } = await open(button('set:leave'), null, ON_LEAVE);

    expect(screen.text).toBe(
      en.settings.leavePrompt('until November 15, 2026'),
    );
    expect(screen.buttons?.[0]).toEqual([
      { text: 'End the vacation', data: 'set:leave:end' },
    ]);
  });

  it.each([
    ['15.11', '2026-11-15'],
    ['04.11.2026', '2026-11-04'],
    ['2027-11-04', '2027-11-04'],
  ])('starts a vacation until %j', async (text, until) => {
    userService.startLeave.mockResolvedValue({
      ...ON_LEAVE,
      onLeaveUntil: until,
    });

    const reply = await open({ type: ChatInputType.TEXT, text }, LEAVE_DIALOG);

    expect(userService.startLeave).toHaveBeenCalledWith(USER.id, until);
    expect(reply.screen.text).toContain('Vacation: until ');
    expect(reply.dialog).toBeNull();
  });

  it.each([
    ['next week', en.settings.leaveInvalid],
    ['31.02.2027', en.settings.leaveInvalid],
    ['03.11.2026', en.settings.leaveOutOfRange],
    ['2027-11-05', en.settings.leaveOutOfRange],
  ])('asks again for %j', async (text, answer) => {
    const reply = await open({ type: ChatInputType.TEXT, text }, LEAVE_DIALOG);

    expect(userService.startLeave).not.toHaveBeenCalled();
    expect(reply.screen.text).toBe(answer);
    expect(reply.dialog).toEqual(LEAVE_DIALOG);
  });

  it('counts today in the time zone of the employee', async () => {
    vi.setSystemTime(new Date('2026-11-04T20:00:00Z'));
    const input: ChatInput = { type: ChatInputType.TEXT, text: '04.11.2026' };

    expect((await open(input, LEAVE_DIALOG)).screen.text).toBe(
      en.settings.leaveOutOfRange,
    );
    await open(input, LEAVE_DIALOG, { ...USER, timezone: 'Europe/London' });
    expect(userService.startLeave).toHaveBeenCalledWith(USER.id, '2026-11-04');
  });

  it('starts a vacation without an end date', async () => {
    userService.startLeave.mockResolvedValue({
      ...ON_LEAVE,
      onLeaveUntil: null,
    });

    const { screen } = await open(button('set:leave:nodate'));

    expect(userService.startLeave).toHaveBeenCalledWith(USER.id, null);
    expect(screen.text).toContain('Vacation: no end date');
  });

  it('ends the vacation', async () => {
    userService.endLeave.mockResolvedValue(USER);

    const { screen } = await open(button('set:leave:end'), null, ON_LEAVE);

    expect(userService.endLeave).toHaveBeenCalledWith(USER.id);
    expect(screen.text).toContain('Vacation: no');
  });

  it.each([
    'set:time:24',
    'set:time:09:10',
    'set:lang:de',
    'set:tz:moscow',
    'set:preset:custom',
    'set:ai',
    'set:aidata:yes',
    'set:empty:on:off',
    'set:gender:other',
    'set:leave:later',
    'set:other',
  ])('answers the outdated button %s', async (data) => {
    expect((await open(button(data))).screen).toEqual({
      text: en.bot.expired,
    });
  });
});
