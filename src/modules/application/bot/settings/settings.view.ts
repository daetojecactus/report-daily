import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScreenButtonStyle } from 'src/common/channel/types/screen.enums';
import { withNotice } from 'src/common/utils/text.util';
import type { Channel } from 'src/common/channel/types/channel.enums';
import type { Screen, ScreenButton } from 'src/common/channel/types/chat-channel.interface';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { Gender } from 'src/modules/application/user/types/user.enums';
import type { User } from 'src/modules/application/user/types/user.interface';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { BOT_BUTTON_DATA_SEPARATOR } from '../core/constants/bot.constants';
import { BotNamespace } from '../core/types/bot.enums';
import {
  SETTINGS_CONFIRM,
  SETTINGS_DEFAULT_TIME_ZONE,
  SETTINGS_HOURS,
  SETTINGS_HOURS_PER_ROW,
  SETTINGS_MINUTES,
  SETTINGS_OFF,
  SETTINGS_ON,
  SETTINGS_TEMPLATES_DATA,
  SETTINGS_TIME_LENGTH,
  SETTINGS_TIME_SEPARATOR,
} from './constants/settings.constants';
import { SettingsAction } from './types/settings.enums';
import type { SettingsSwitch } from './types/settings.interface';

interface SettingsChannelState {
  channel: Channel;
  isOn: boolean;
}

interface SettingsOverview {
  user: User;
  language: Language;
  channels: Channel[];
  hasChannelChoice: boolean;
  isAiEnabled: boolean;
  templateName: string;
}

@Injectable()
export class SettingsView {
  private readonly defaultTimeZone: string;

  constructor(configService: ConfigService<AppEnvs, true>) {
    this.defaultTimeZone = configService.get('APP_TIMEZONE', { infer: true });
  }

  toMenu(locale: Locale, overview: SettingsOverview): Screen {
    const { settings } = locale;
    const { user, language, channels, hasChannelChoice, isAiEnabled, templateName } = overview;
    return {
      text: [
        settings.title,
        ...this.toGeneralLines(locale, user, language),
        '',
        ...this.toSwitchLines(locale, user, isAiEnabled),
        '',
        `${settings.channels}: ${channels.map((channel) => locale.channels[channel]).join(', ')}`,
        `${settings.template}: ${templateName}`,
      ].join('\n'),
      buttons: [
        [{ text: settings.general, data: this.toData(SettingsAction.GENERAL) }],
        [
          {
            text: isAiEnabled ? settings.reports : settings.reportsWithoutAi,
            data: this.toData(SettingsAction.REPORTS),
          },
        ],
        ...(hasChannelChoice
          ? [[{ text: settings.channels, data: this.toData(SettingsAction.CHANNELS) }]]
          : []),
        [{ text: settings.template, data: SETTINGS_TEMPLATES_DATA }],
      ],
    };
  }

  toGeneral(locale: Locale, user: User, language: Language): Screen {
    const { settings } = locale;
    return {
      text: [`**${settings.general}**`, ...this.toGeneralLines(locale, user, language)].join('\n'),
      buttons: [
        [
          { text: settings.language, data: this.toData(SettingsAction.LANGUAGE) },
          { text: settings.reportTime, data: this.toData(SettingsAction.TIME) },
        ],
        [
          { text: settings.timeZone, data: this.toData(SettingsAction.TIME_ZONE) },
          { text: settings.gender, data: this.toData(SettingsAction.GENDER) },
        ],
        [this.toBackButton(locale, SettingsAction.MENU)],
      ],
    };
  }

  toReports(locale: Locale, user: User, isAiEnabled: boolean): Screen {
    const { settings } = locale;
    const switches = this.toSwitches(user, isAiEnabled);
    return {
      text: [
        `**${isAiEnabled ? settings.reports : settings.reportsWithoutAi}**`,
        ...this.toSwitchLines(locale, user, isAiEnabled),
      ].join('\n'),
      buttons: [
        ...switches.map(({ action, isOn }) => [
          {
            text: this.toSwitchText(locale, action).name,
            data: this.toData(action, isOn ? SETTINGS_OFF : SETTINGS_ON),
          },
        ]),
        [this.toBackButton(locale, SettingsAction.MENU)],
      ],
    };
  }

  toChannels(locale: Locale, channels: SettingsChannelState[], notice?: string): Screen {
    const { settings } = locale;
    return {
      text: withNotice(
        [
          `**${settings.channels}**`,
          ...channels.map(
            ({ channel, isOn }) => `${locale.channels[channel]}: ${this.toState(locale, isOn)}`,
          ),
        ],
        notice,
      ).join('\n'),
      buttons: [
        channels.map(({ channel, isOn }) => ({
          text: locale.channels[channel],
          data: this.toData(SettingsAction.RECEIVE, channel, isOn ? SETTINGS_OFF : SETTINGS_ON),
        })),
        [this.toBackButton(locale, SettingsAction.MENU)],
      ],
    };
  }

  toSwitchConfirm(locale: Locale, action: SettingsSwitch['action'], isOn: boolean): Screen {
    const { name, description } = this.toSwitchText(locale, action);
    return this.toConfirm(
      locale,
      [name, description],
      isOn,
      this.toData(action, isOn ? SETTINGS_ON : SETTINGS_OFF, SETTINGS_CONFIRM),
      SettingsAction.REPORTS,
    );
  }

  toChannelConfirm(locale: Locale, channel: Channel, isOn: boolean): Screen {
    return this.toConfirm(
      locale,
      [locale.channels[channel], locale.settings.channelDescription],
      isOn,
      this.toData(
        SettingsAction.RECEIVE,
        channel,
        isOn ? SETTINGS_ON : SETTINGS_OFF,
        SETTINGS_CONFIRM,
      ),
      SettingsAction.CHANNELS,
    );
  }

  toLanguages(locale: Locale): Screen {
    return {
      text: locale.settings.chooseLanguage,
      buttons: [
        ...Object.values(Language).map((language) => [
          {
            text: locale.languages[language],
            data: this.toData(SettingsAction.LANGUAGE, language),
          },
        ]),
        [this.toBackButton(locale, SettingsAction.GENERAL)],
      ],
    };
  }

  toHours(locale: Locale, user: User): Screen {
    const rows: ScreenButton[][] = [];
    for (let index = 0; index < SETTINGS_HOURS.length; index += SETTINGS_HOURS_PER_ROW) {
      rows.push(
        SETTINGS_HOURS.slice(index, index + SETTINGS_HOURS_PER_ROW).map((hour) => ({
          text: hour,
          data: this.toData(SettingsAction.TIME, hour),
        })),
      );
    }
    return {
      text: locale.settings.chooseHour(this.describeTimeZone(locale, user)),
      buttons: [...rows, [this.toBackButton(locale, SettingsAction.GENERAL)]],
    };
  }

  toMinutes(locale: Locale, hour: string): Screen {
    return {
      text: locale.settings.chooseMinute,
      buttons: [
        SETTINGS_MINUTES.map((minute) => ({
          text: [hour, minute].join(SETTINGS_TIME_SEPARATOR),
          data: this.toData(SettingsAction.TIME, hour, minute),
        })),
        [this.toBackButton(locale, SettingsAction.TIME)],
      ],
    };
  }

  toTimeZonePrompt(locale: Locale, user: User, text?: string): Screen {
    return {
      text: text ?? locale.settings.timeZonePrompt(this.describeTimeZone(locale, user)),
      buttons: [
        [
          {
            text: locale.settings.useDefault(this.defaultTimeZone),
            data: this.toData(SettingsAction.TIME_ZONE, SETTINGS_DEFAULT_TIME_ZONE),
          },
        ],
        [this.toBackButton(locale, SettingsAction.GENERAL)],
      ],
    };
  }

  toGenders(locale: Locale): Screen {
    return {
      text: locale.settings.chooseGender,
      buttons: [
        Object.values(Gender).map((gender) => ({
          text: locale.genders[gender],
          data: this.toData(SettingsAction.GENDER, gender),
        })),
        [this.toBackButton(locale, SettingsAction.GENERAL)],
      ],
    };
  }

  private toConfirm(
    locale: Locale,
    [name, description]: [string, string],
    isOn: boolean,
    confirmData: string,
    back: SettingsAction,
  ): Screen {
    const { settings } = locale;
    return {
      text: [`**${name}**`, description, settings.now(this.toState(locale, !isOn))].join('\n'),
      buttons: [
        [
          {
            text: isOn ? settings.turnOn : settings.turnOff,
            data: confirmData,
            style: isOn ? ScreenButtonStyle.PRIMARY : ScreenButtonStyle.DANGER,
          },
          this.toBackButton(locale, back),
        ],
      ],
    };
  }

  private toGeneralLines(locale: Locale, user: User, language: Language) {
    const { settings } = locale;
    return [
      `${settings.language}: ${locale.languages[language]}`,
      `${settings.reportTime}: ${user.reportTime.slice(0, SETTINGS_TIME_LENGTH)}`,
      `${settings.timeZone}: ${this.describeTimeZone(locale, user)}`,
      `${settings.gender}: ${locale.genders[user.gender]}`,
    ];
  }

  private toSwitchLines(locale: Locale, user: User, isAiEnabled: boolean) {
    return this.toSwitches(user, isAiEnabled).map(
      ({ action, isOn }) =>
        `${this.toSwitchText(locale, action).name}: ${this.toState(locale, isOn)}`,
    );
  }

  private toSwitches(user: User, isAiEnabled: boolean): SettingsSwitch[] {
    return [
      { action: SettingsAction.SCHEDULE, isOn: user.scheduleEnabled },
      ...(isAiEnabled
        ? [
            { action: SettingsAction.AI, isOn: user.aiEnabled } as const,
            { action: SettingsAction.AI_DATA, isOn: !user.aiDataOptOut } as const,
          ]
        : []),
    ];
  }

  private toSwitchText(locale: Locale, action: SettingsSwitch['action']) {
    switch (action) {
      case SettingsAction.SCHEDULE:
        return locale.settings.schedule;
      case SettingsAction.AI:
        return locale.settings.ai;
      case SettingsAction.AI_DATA:
        return locale.settings.aiData;
    }
  }

  private toState(locale: Locale, isOn: boolean) {
    return isOn ? locale.settings.on : locale.settings.off;
  }

  private describeTimeZone(locale: Locale, user: User) {
    return user.timezone
      ? `\`${user.timezone}\``
      : locale.settings.defaultTimeZone(`\`${this.defaultTimeZone}\``);
  }

  private toBackButton(locale: Locale, action: SettingsAction) {
    return { text: locale.settings.back, data: this.toData(action) };
  }

  private toData(...parts: string[]) {
    return [BotNamespace.SETTINGS, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
