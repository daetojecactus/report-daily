import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatInputType } from 'src/common/enums/channel.enums';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { toTimeZone } from 'src/common/utils/time-zone.util';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { REPORT_ROLE_PRESETS } from 'src/modules/application/report/constants/report.constants';
import { ReportPreset } from 'src/modules/application/report/report.enums';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import type {
  User,
  UserSettingsUpdate,
} from 'src/modules/application/user/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotCommand, BotNamespace } from '../bot.enums';
import type { BotContext, BotHandler, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { MenuService } from '../menu/menu.service';
import {
  SETTINGS_BUTTON_SCHEMA,
  SETTINGS_DEFAULT_TIME_ZONE,
  SETTINGS_HOURS,
  SETTINGS_HOURS_PER_ROW,
  SETTINGS_MINUTES,
  SETTINGS_OFF,
  SETTINGS_ON,
  SETTINGS_ROLE_PRESET,
  SETTINGS_TIME_LENGTH,
  SETTINGS_TIME_SEPARATOR,
} from './constants/settings.constants';
import { SettingsAction, SettingsStep } from './settings.enums';

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
  ) {
    this.defaultTimeZone = configService.get('APP_TIMEZONE', { infer: true });
  }

  async handle({
    actor,
    input,
    dialog,
    locale,
  }: BotContext): Promise<BotReply> {
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

    const button = SETTINGS_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
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
        return this.chooseTime(
          locale,
          user,
          actor.language,
          button.data.hour,
          button.data.minute,
        );
      case SettingsAction.TIME_ZONE:
        return button.data.isDefault
          ? this.save(locale, user, actor.language, { timezone: null })
          : this.askTimeZone(locale, user);
      case SettingsAction.PRESET:
        return button.data.isChoice
          ? this.save(locale, user, actor.language, {
              preset: button.data.preset,
            })
          : this.askPreset(locale, user);
      case SettingsAction.AI:
        return this.save(locale, user, actor.language, {
          aiEnabled: button.data.isOn,
        });
      case SettingsAction.AI_DATA:
        return this.save(locale, user, actor.language, {
          aiDataOptOut: !button.data.isOn,
        });
      case SettingsAction.NOTIFY_EMPTY:
        return this.save(locale, user, actor.language, {
          notifyEmpty: button.data.isOn,
        });
    }
  }

  private showMenu(locale: Locale, user: User, language: Language): BotReply {
    const { settings } = locale;
    const switches = [
      { action: SettingsAction.AI, text: settings.ai, isOn: user.aiEnabled },
      {
        action: SettingsAction.AI_DATA,
        text: settings.aiData,
        isOn: !user.aiDataOptOut,
      },
      {
        action: SettingsAction.NOTIFY_EMPTY,
        text: settings.notifyEmpty,
        isOn: user.notifyEmpty,
      },
    ];
    return {
      screen: {
        text: [
          settings.title,
          `${settings.language}: ${locale.languages[language]}`,
          `${settings.reportTime}: ${user.reportTime.slice(0, SETTINGS_TIME_LENGTH)}`,
          `${settings.timeZone}: ${this.describeTimeZone(locale, user)}`,
          `${settings.preset}: ${this.describePreset(locale, user)}`,
          '',
          ...switches.map(
            ({ text }) => `**${text.name}** — ${text.description}`,
          ),
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
              text: settings.preset,
              data: this.toData(SettingsAction.PRESET),
            },
          ],
          ...switches.map(({ action, text, isOn }) => [
            {
              text: `${text.name}: ${isOn ? settings.on : settings.off}`,
              data: this.toData(action, isOn ? SETTINGS_OFF : SETTINGS_ON),
            },
          ]),
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
    const updated =
      (await this.userService.updateSettings(user.id, { language })) ?? user;
    await this.menuService.syncEmployee(
      updated,
      await this.channelService.findByUser(updated.id),
    );
    return this.showMenu(
      this.i18nService.getLocale(language),
      updated,
      language,
    );
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
    for (
      let index = 0;
      index < SETTINGS_HOURS.length;
      index += SETTINGS_HOURS_PER_ROW
    ) {
      rows.push(
        SETTINGS_HOURS.slice(index, index + SETTINGS_HOURS_PER_ROW).map(
          (value) => ({
            text: value,
            data: this.toData(SettingsAction.TIME, value),
          }),
        ),
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
              data: this.toData(
                SettingsAction.TIME_ZONE,
                SETTINGS_DEFAULT_TIME_ZONE,
              ),
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

  private saveTimeZone(
    locale: Locale,
    user: User,
    language: Language,
    text: string,
  ) {
    const timezone = toTimeZone(text);
    if (!timezone) {
      return this.askTimeZone(locale, user, locale.settings.timeZoneInvalid);
    }
    return this.save(locale, user, language, { timezone });
  }

  private askPreset(locale: Locale, user: User): BotReply {
    const { settings } = locale;
    const presets = Object.values(ReportPreset);
    return {
      screen: {
        text: [
          settings.choosePreset(this.describePreset(locale, user)),
          '',
          ...presets.map(
            (preset) =>
              `**${locale.presets[preset]}** — ${settings.presetDescriptions[preset]}`,
          ),
        ].join('\n'),
        buttons: [
          [
            {
              text: settings.byRole(this.describeRolePreset(locale, user)),
              data: this.toData(SettingsAction.PRESET, SETTINGS_ROLE_PRESET),
            },
          ],
          presets.map((preset) => ({
            text: locale.presets[preset],
            data: this.toData(SettingsAction.PRESET, preset),
          })),
          [this.toBackButton(locale, SettingsAction.MENU)],
        ],
      },
      dialog: null,
    };
  }

  private async save(
    locale: Locale,
    user: User,
    language: Language,
    update: UserSettingsUpdate,
  ) {
    const updated =
      (await this.userService.updateSettings(user.id, update)) ?? user;
    return this.showMenu(locale, updated, language);
  }

  private describeTimeZone(locale: Locale, user: User) {
    return user.timezone
      ? `\`${user.timezone}\``
      : locale.settings.defaultTimeZone(`\`${this.defaultTimeZone}\``);
  }

  private describePreset(locale: Locale, user: User) {
    return user.preset
      ? locale.presets[user.preset]
      : locale.settings.presetByRole(this.describeRolePreset(locale, user));
  }

  private describeRolePreset(locale: Locale, user: User) {
    return locale.presets[REPORT_ROLE_PRESETS[user.role]];
  }

  private toBackButton(locale: Locale, action: SettingsAction) {
    return { text: locale.settings.back, data: this.toData(action) };
  }

  private toData(...parts: string[]) {
    return [BotNamespace.SETTINGS, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
