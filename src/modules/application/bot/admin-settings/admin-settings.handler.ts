import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatInputType } from 'src/common/enums/channel.enums';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { addDays, getToday } from 'src/common/utils/date.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import type { ReportsPause } from 'src/modules/application/settings/settings.interface';
import { SettingsService } from 'src/modules/application/settings/settings.service';
import { Permission } from 'src/modules/application/user/user.enums';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { ADMIN_MENU_DATA } from '../admin/constants/admin.constants';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotNamespace } from '../bot.enums';
import type { BotActor, BotContext, BotHandler, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { AdminSettingsAction } from './admin-settings.enums';
import {
  ADMIN_SETTINGS_BUTTON_SCHEMA,
  ADMIN_SETTINGS_DATE_FORMAT,
  ADMIN_SETTINGS_DATE_TIME_SUFFIX,
  ADMIN_SETTINGS_DAY_BUTTON_FORMAT,
  ADMIN_SETTINGS_DAYS_AHEAD,
  ADMIN_SETTINGS_DAYS_PER_ROW,
} from './constants/admin-settings.constants';
import { AdminSettingsMessages } from './constants/admin-settings.messages';

@Injectable()
@BotSection({ access: Permission.SETTINGS, namespace: BotNamespace.ADMIN_SETTINGS })
export class AdminSettingsHandler implements BotHandler {
  private readonly logger = new Logger(AdminSettingsHandler.name);
  private readonly timeZone: string;

  constructor(
    private readonly settingsService: SettingsService,
    configService: ConfigService<AppEnvs, true>,
  ) {
    this.timeZone = configService.get('APP_TIMEZONE', { infer: true });
  }

  async handle({ actor, input, locale }: BotContext): Promise<BotReply> {
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }
    const button = ADMIN_SETTINGS_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    const today = getToday(this.timeZone);
    switch (button.data.action) {
      case AdminSettingsAction.MENU:
        return this.showMenu(locale, today);
      case AdminSettingsAction.DAYS:
        return this.showDays(locale, today);
      case AdminSettingsAction.TODAY:
        return this.pause(actor, locale, today, today);
      case AdminSettingsAction.UNTIL:
        return this.isAhead(button.data.date, today)
          ? this.pause(actor, locale, today, button.data.date)
          : { screen: { text: locale.bot.expired } };
      case AdminSettingsAction.FOREVER:
        return this.pause(actor, locale, today, null);
      case AdminSettingsAction.RESUME:
        await this.settingsService.resumeReports();
        this.logger.log(
          { actorId: actor.user?.id ?? BotAccess.OWNER },
          AdminSettingsMessages.RESUMED,
        );
        return this.showMenu(locale, today);
    }
  }

  private async showMenu(locale: Locale, today: string): Promise<BotReply> {
    const texts = locale.adminSettings;
    const pause = await this.settingsService.findReportsPause(today);
    return {
      screen: {
        text: [texts.title, this.toState(locale, pause, today), texts.hint].join('\n'),
        buttons: [
          [{ text: texts.pauseToday, data: this.toData(AdminSettingsAction.TODAY) }],
          [{ text: texts.pauseUntil, data: this.toData(AdminSettingsAction.DAYS) }],
          [{ text: texts.pauseForever, data: this.toData(AdminSettingsAction.FOREVER) }],
          ...(pause
            ? [[{ text: texts.resume, data: this.toData(AdminSettingsAction.RESUME) }]]
            : []),
          [{ text: texts.menu, data: ADMIN_MENU_DATA }],
        ],
      },
      dialog: null,
    };
  }

  private showDays(locale: Locale, today: string): BotReply {
    const format = new Intl.DateTimeFormat(
      locale.phrases.dateLocale,
      ADMIN_SETTINGS_DAY_BUTTON_FORMAT,
    );
    const days: ScreenButton[] = [];
    for (let offset = 1; offset <= ADMIN_SETTINGS_DAYS_AHEAD; offset++) {
      const date = addDays(today, offset);
      days.push({
        text: format.format(this.toInstant(date)),
        data: this.toData(AdminSettingsAction.UNTIL, date),
      });
    }
    const rows: ScreenButton[][] = [];
    for (let index = 0; index < days.length; index += ADMIN_SETTINGS_DAYS_PER_ROW) {
      rows.push(days.slice(index, index + ADMIN_SETTINGS_DAYS_PER_ROW));
    }
    return {
      screen: {
        text: locale.adminSettings.chooseDay(ADMIN_SETTINGS_DAYS_AHEAD),
        buttons: [
          ...rows,
          [{ text: locale.adminSettings.back, data: this.toData(AdminSettingsAction.MENU) }],
        ],
      },
      dialog: null,
    };
  }

  private async pause(
    actor: BotActor,
    locale: Locale,
    today: string,
    until: string | null,
  ): Promise<BotReply> {
    await this.settingsService.pauseReports(until);
    this.logger.log(
      { actorId: actor.user?.id ?? BotAccess.OWNER, until },
      AdminSettingsMessages.PAUSED,
    );
    return this.showMenu(locale, today);
  }

  private toState(locale: Locale, pause: ReportsPause | null, today: string) {
    const texts = locale.adminSettings;
    if (!pause) {
      return texts.reportsOn;
    }
    if (pause.until === null) {
      return texts.pausedForever;
    }
    if (pause.until === today) {
      return texts.pausedToday;
    }
    return texts.pausedUntil(
      new Intl.DateTimeFormat(locale.phrases.dateLocale, ADMIN_SETTINGS_DATE_FORMAT).format(
        this.toInstant(pause.until),
      ),
    );
  }

  private isAhead(date: string, today: string) {
    return date > today && date <= addDays(today, ADMIN_SETTINGS_DAYS_AHEAD);
  }

  private toInstant(date: string) {
    return new Date(`${date}${ADMIN_SETTINGS_DATE_TIME_SUFFIX}`);
  }

  private toData(...parts: string[]) {
    return [BotNamespace.ADMIN_SETTINGS, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
