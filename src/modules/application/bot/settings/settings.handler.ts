import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatChannel, ScreenButton } from 'src/common/channel/types/chat-channel.interface';
import { toTimeZone } from 'src/common/utils/time-zone.util';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { Gender } from 'src/modules/application/user/types/user.enums';
import type { User, UserSettingsUpdate } from 'src/modules/application/user/types/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { BotSection } from '../core/bot.decorator';
import { BotAccess, BotCommand, BotNamespace } from '../core/types/bot.enums';
import type { BotContext, BotHandler, BotReply } from '../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR, BOT_CHANNELS } from '../core/constants/bot.constants';
import { MenuService } from '../core/menu.service';
import {
  SETTINGS_TEMPLATES_DATA,
  SETTINGS_BUTTON_SCHEMA,
  SETTINGS_DEFAULT_TIME_ZONE,
  SETTINGS_HOURS,
  SETTINGS_HOURS_PER_ROW,
  SETTINGS_MINUTES,
  SETTINGS_OFF,
  SETTINGS_ON,
  SETTINGS_TIME_LENGTH,
  SETTINGS_TIME_SEPARATOR,
} from './constants/settings.constants';
import { SettingsAction, SettingsStep } from './types/settings.enums';

@Injectable()
@BotSection({
  access: BotAccess.EMPLOYEE,
  commands: [BotCommand.SETTINGS],
  namespace: BotNamespace.SETTINGS,
})
export class SettingsHandler implements BotHandler {
  private readonly defaultTimeZone: string;

  constructor(
    configService: ConfigService<AppEnvs, true>,
    private readonly userService: UserService,
    private readonly channelService: ChannelService,
    private readonly menuService: MenuService,
    private readonly i18nService: I18nService,
    @Inject(BOT_CHANNELS) private readonly channels: ChatChannel[],
  ) {
    this.defaultTimeZone = configService.get('APP_TIMEZONE', { infer: true });
  }

  async handle({ actor, input, dialog, locale }: BotContext): Promise<BotReply> {
    const { user } = actor;
    if (!user) {
      return { screen: { text: locale.bot.forbidden } };
    }
    if (input.type === ChatInputType.COMMAND) {
      return this.showMenu(locale, user, actor.language);
    }
    if (input.type === ChatInputType.TEXT) {
      return dialog?.step === SettingsStep.TIME_ZONE
        ? this.saveTimeZone(locale, user, actor.language, input.text)
        : { screen: { text: locale.bot.unknownInput } };
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }

    const button = SETTINGS_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR));
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case SettingsAction.MENU:
        return this.showMenu(locale, user, actor.language);
      case SettingsAction.LANGUAGE:
        return button.data.language
          ? this.saveLanguage(user, button.data.language)
          : this.askLanguage(locale);
      case SettingsAction.TIME:
        return this.chooseTime(locale, user, actor.language, button.data.hour, button.data.minute);
      case SettingsAction.TIME_ZONE:
        return button.data.isDefault
          ? this.save(locale, user, actor.language, { timezone: null })
          : this.askTimeZone(locale, user);
      case SettingsAction.GENDER:
        return button.data.gender
          ? this.save(locale, user, actor.language, {
              gender: button.data.gender,
            })
          : this.askGender(locale);
      case SettingsAction.SCHEDULE:
        return this.save(locale, user, actor.language, {
          scheduleEnabled: button.data.isOn,
        });
      case SettingsAction.AI:
        return this.save(locale, user, actor.language, {
          aiEnabled: button.data.isOn,
        });
      case SettingsAction.AI_DATA:
        return this.save(locale, user, actor.language, {
          aiDataOptOut: !button.data.isOn,
        });
      case SettingsAction.RECEIVE:
        return this.saveReceiving(
          locale,
          user,
          actor.language,
          button.data.channel,
          button.data.isOn,
        );
    }
  }

  private async showMenu(
    locale: Locale,
    user: User,
    language: Language,
    notice?: string,
  ): Promise<BotReply> {
    const { settings } = locale;
    const bound = await this.findBound(user.id);
    const receiving = this.channelService.toReceiving(bound);
    const channelButtons = bound.map(({ channel }) => {
      const isOn = receiving.some((item) => item.channel === channel);
      return {
        text: `${locale.channels[channel]}: ${isOn ? settings.on : settings.off}`,
        data: this.toData(SettingsAction.RECEIVE, channel, isOn ? SETTINGS_OFF : SETTINGS_ON),
      };
    });
    const hasChoice = channelButtons.length > 1;
    const switches = [
      { action: SettingsAction.SCHEDULE, text: settings.schedule, isOn: user.scheduleEnabled },
      { action: SettingsAction.AI, text: settings.ai, isOn: user.aiEnabled },
      {
        action: SettingsAction.AI_DATA,
        text: settings.aiData,
        isOn: !user.aiDataOptOut,
      },
    ];
    return {
      screen: {
        text: [
          ...(notice ? [notice, ''] : []),
          settings.title,
          `${settings.language}: ${locale.languages[language]}`,
          `${settings.reportTime}: ${user.reportTime.slice(0, SETTINGS_TIME_LENGTH)}`,
          `${settings.timeZone}: ${this.describeTimeZone(locale, user)}`,
          `${settings.gender}: ${locale.genders[user.gender]}`,
          '',
          ...switches.map(({ text }) => `**${text.name}** — ${text.description}`),
          ...(hasChoice
            ? [`**${settings.channels.name}** — ${settings.channels.description}`]
            : []),
        ].join('\n'),
        buttons: [
          [
            {
              text: settings.language,
              data: this.toData(SettingsAction.LANGUAGE),
            },
            {
              text: settings.reportTime,
              data: this.toData(SettingsAction.TIME),
            },
          ],
          [
            {
              text: settings.timeZone,
              data: this.toData(SettingsAction.TIME_ZONE),
            },
            {
              text: settings.gender,
              data: this.toData(SettingsAction.GENDER),
            },
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
      },
      dialog: null,
    };
  }

  private askLanguage(locale: Locale): BotReply {
    return {
      screen: {
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
      },
      dialog: null,
    };
  }

  private async saveLanguage(user: User, language: Language) {
    const updated = (await this.userService.updateSettings(user.id, { language })) ?? user;
    await this.menuService.syncEmployee(updated, await this.channelService.findByUser(updated.id));
    return this.showMenu(this.i18nService.getLocale(language), updated, language);
  }

  private chooseTime(
    locale: Locale,
    user: User,
    language: Language,
    hour: string | null,
    minute: string | null,
  ): BotReply | Promise<BotReply> {
    if (hour && minute) {
      return this.save(locale, user, language, {
        reportTime: [hour, minute].join(SETTINGS_TIME_SEPARATOR),
      });
    }
    if (hour) {
      return {
        screen: {
          text: locale.settings.chooseMinute,
          buttons: [
            SETTINGS_MINUTES.map((value) => ({
              text: [hour, value].join(SETTINGS_TIME_SEPARATOR),
              data: this.toData(SettingsAction.TIME, hour, value),
            })),
            [this.toBackButton(locale, SettingsAction.TIME)],
          ],
        },
        dialog: null,
      };
    }

    const rows: ScreenButton[][] = [];
    for (let index = 0; index < SETTINGS_HOURS.length; index += SETTINGS_HOURS_PER_ROW) {
      rows.push(
        SETTINGS_HOURS.slice(index, index + SETTINGS_HOURS_PER_ROW).map((value) => ({
          text: value,
          data: this.toData(SettingsAction.TIME, value),
        })),
      );
    }
    return {
      screen: {
        text: locale.settings.chooseHour(this.describeTimeZone(locale, user)),
        buttons: [...rows, [this.toBackButton(locale, SettingsAction.MENU)]],
      },
      dialog: null,
    };
  }

  private askTimeZone(
    locale: Locale,
    user: User,
    text = locale.settings.timeZonePrompt(this.describeTimeZone(locale, user)),
  ): BotReply {
    return {
      screen: {
        text,
        buttons: [
          [
            {
              text: locale.settings.useDefault(this.defaultTimeZone),
              data: this.toData(SettingsAction.TIME_ZONE, SETTINGS_DEFAULT_TIME_ZONE),
            },
          ],
          [this.toBackButton(locale, SettingsAction.MENU)],
        ],
      },
      dialog: {
        namespace: BotNamespace.SETTINGS,
        step: SettingsStep.TIME_ZONE,
        data: {},
      },
    };
  }

  private saveTimeZone(locale: Locale, user: User, language: Language, text: string) {
    const timezone = toTimeZone(text);
    if (!timezone) {
      return this.askTimeZone(locale, user, locale.settings.timeZoneInvalid);
    }
    return this.save(locale, user, language, { timezone });
  }

  private askGender(locale: Locale): BotReply {
    return {
      screen: {
        text: locale.settings.chooseGender,
        buttons: [
          Object.values(Gender).map((gender) => ({
            text: locale.genders[gender],
            data: this.toData(SettingsAction.GENDER, gender),
          })),
          [this.toBackButton(locale, SettingsAction.MENU)],
        ],
      },
      dialog: null,
    };
  }

  private async saveReceiving(
    locale: Locale,
    user: User,
    language: Language,
    channel: Channel,
    isOn: boolean,
  ) {
    const bound = await this.findBound(user.id);
    if (bound.some((item) => item.channel === channel)) {
      const receiving = this.channelService
        .toReceiving(bound)
        .map((item) => item.channel)
        .filter((item) => item !== channel);
      if (isOn) {
        receiving.push(channel);
      }
      if (receiving.length === 0) {
        return this.showMenu(locale, user, language, locale.settings.lastChannel);
      }
      await this.channelService.updateReceiving(
        user.id,
        bound.map((item) => item.channel),
        receiving,
      );
    }
    return this.showMenu(locale, user, language);
  }

  private findBound(userId: string) {
    return this.channelService.findBound(
      userId,
      this.channels.map(({ channel }) => channel),
    );
  }

  private async save(locale: Locale, user: User, language: Language, update: UserSettingsUpdate) {
    const updated = (await this.userService.updateSettings(user.id, update)) ?? user;
    return this.showMenu(locale, updated, language);
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
