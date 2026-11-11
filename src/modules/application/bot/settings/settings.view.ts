import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

interface SettingsChannelState {
  channel: Channel;
  isOn: boolean;
}

@Injectable()
export class SettingsView {
  private readonly defaultTimeZone: string;

  constructor(configService: ConfigService<AppEnvs, true>) {
    this.defaultTimeZone = configService.get('APP_TIMEZONE', { infer: true });
  }

  toMenu(
    locale: Locale,
    user: User,
    language: Language,
    channels: SettingsChannelState[],
    notice?: string,
  ): Screen {
    const { settings } = locale;
    const switches = [
      { action: SettingsAction.SCHEDULE, text: settings.schedule, isOn: user.scheduleEnabled },
      { action: SettingsAction.AI, text: settings.ai, isOn: user.aiEnabled },
      { action: SettingsAction.AI_DATA, text: settings.aiData, isOn: !user.aiDataOptOut },
    ];
    const hasChoice = channels.length > 1;
    const channelButtons = channels.map(({ channel, isOn }) => ({
      text: `${locale.channels[channel]}: ${isOn ? settings.on : settings.off}`,
      data: this.toData(SettingsAction.RECEIVE, channel, isOn ? SETTINGS_OFF : SETTINGS_ON),
    }));
    return {
      text: [
        ...(notice ? [notice, ''] : []),
        settings.title,
        `${settings.language}: ${locale.languages[language]}`,
        `${settings.reportTime}: ${user.reportTime.slice(0, SETTINGS_TIME_LENGTH)}`,
        `${settings.timeZone}: ${this.describeTimeZone(locale, user)}`,
        `${settings.gender}: ${locale.genders[user.gender]}`,
        '',
        ...switches.map(({ text }) => `**${text.name}** — ${text.description}`),
        ...(hasChoice ? [`**${settings.channels.name}** — ${settings.channels.description}`] : []),
      ].join('\n'),
      buttons: [
        [
          { text: settings.language, data: this.toData(SettingsAction.LANGUAGE) },
          { text: settings.reportTime, data: this.toData(SettingsAction.TIME) },
        ],
        [
          { text: settings.timeZone, data: this.toData(SettingsAction.TIME_ZONE) },
          { text: settings.gender, data: this.toData(SettingsAction.GENDER) },
        ],
        ...switches.map(({ action, text, isOn }) => [
          {
            text: `${text.name}: ${isOn ? settings.on : settings.off}`,
            data: this.toData(action, isOn ? SETTINGS_OFF : SETTINGS_ON),
          },
        ]),
        ...(hasChoice ? [channelButtons] : []),
        [{ text: settings.template, data: SETTINGS_TEMPLATES_DATA }],
      ],
    };
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
        [this.toBackButton(locale, SettingsAction.MENU)],
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
      buttons: [...rows, [this.toBackButton(locale, SettingsAction.MENU)]],
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
        [this.toBackButton(locale, SettingsAction.MENU)],
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
        [this.toBackButton(locale, SettingsAction.MENU)],
      ],
    };
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
