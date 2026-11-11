import { Inject, Injectable } from '@nestjs/common';
import { type Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatChannel, Screen } from 'src/common/channel/types/chat-channel.interface';
import { toTimeZone } from 'src/common/utils/time-zone.util';
import type { Language } from 'src/modules/application/i18n/types/i18n.enums';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { AiService } from 'src/modules/application/ai/ai.service';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import type { User, UserSettingsUpdate } from 'src/modules/application/user/types/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { BotSection } from '../core/bot.decorator';
import { BotAccess, BotCommand, BotNamespace } from '../core/types/bot.enums';
import type { BotContext, BotHandler, BotReply } from '../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR, BOT_CHANNELS } from '../core/constants/bot.constants';
import { MenuService } from '../core/menu.service';
import { SETTINGS_BUTTON_SCHEMA, SETTINGS_TIME_SEPARATOR } from './constants/settings.constants';
import { SettingsAction, SettingsStep } from './types/settings.enums';
import { SettingsView } from './settings.view';

@Injectable()
@BotSection({
  access: BotAccess.EMPLOYEE,
  commands: [BotCommand.SETTINGS],
  namespace: BotNamespace.SETTINGS,
})
export class SettingsHandler implements BotHandler {
  constructor(
    private readonly userService: UserService,
    private readonly channelService: ChannelService,
    private readonly menuService: MenuService,
    private readonly i18nService: I18nService,
    private readonly settingsView: SettingsView,
    @Inject(BOT_CHANNELS) private readonly channels: ChatChannel[],
    private readonly aiService: AiService,
  ) {}

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
          : this.reply(this.settingsView.toLanguages(locale));
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
          : this.reply(this.settingsView.toGenders(locale));
      case SettingsAction.SCHEDULE:
        return this.save(locale, user, actor.language, {
          scheduleEnabled: button.data.isOn,
        });
      case SettingsAction.AI:
        return this.aiService.isEnabled()
          ? this.save(locale, user, actor.language, { aiEnabled: button.data.isOn })
          : { screen: { text: locale.bot.expired } };
      case SettingsAction.AI_DATA:
        return this.aiService.isEnabled()
          ? this.save(locale, user, actor.language, { aiDataOptOut: !button.data.isOn })
          : { screen: { text: locale.bot.expired } };
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
    const bound = await this.findBound(user.id);
    const receiving = this.channelService.toReceiving(bound);
    const channels = bound.map(({ channel }) => ({
      channel,
      isOn: receiving.some((item) => item.channel === channel),
    }));
    return this.reply(
      this.settingsView.toMenu(
        locale,
        user,
        language,
        channels,
        this.aiService.isEnabled(),
        notice,
      ),
    );
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
    return this.reply(
      hour ? this.settingsView.toMinutes(locale, hour) : this.settingsView.toHours(locale, user),
    );
  }

  private askTimeZone(locale: Locale, user: User, text?: string): BotReply {
    return {
      screen: this.settingsView.toTimeZonePrompt(locale, user, text),
      dialog: { namespace: BotNamespace.SETTINGS, step: SettingsStep.TIME_ZONE, data: {} },
    };
  }

  private saveTimeZone(locale: Locale, user: User, language: Language, text: string) {
    const timezone = toTimeZone(text);
    if (!timezone) {
      return this.askTimeZone(locale, user, locale.settings.timeZoneInvalid);
    }
    return this.save(locale, user, language, { timezone });
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

  private reply(screen: Screen): BotReply {
    return { screen, dialog: null };
  }
}
