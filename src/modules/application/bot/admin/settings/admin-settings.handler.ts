import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ScreenButton } from 'src/common/channel/types/chat-channel.interface';
import { addDays, getToday } from 'src/common/utils/date.util';
import { AiService } from 'src/modules/application/ai/ai.service';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import type {
  ReportsPause,
  SettingsAi,
} from 'src/modules/application/settings/types/settings.interface';
import { SettingsService } from 'src/modules/application/settings/settings.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { ADMIN_MENU_DATA } from '../constants/admin.constants';
import { BotSection } from '../../core/bot.decorator';
import { BotAccess, BotNamespace } from '../../core/types/bot.enums';
import type { BotActor, BotContext, BotHandler, BotReply } from '../../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../../core/constants/bot.constants';
import { AdminSettingsAction } from './types/admin-settings.enums';
import {
  ADMIN_SETTINGS_AI_SWITCHES,
  ADMIN_SETTINGS_BUTTON_SCHEMA,
  ADMIN_SETTINGS_DATE_FORMAT,
  ADMIN_SETTINGS_DATE_TIME_SUFFIX,
  ADMIN_SETTINGS_DAY_BUTTON_FORMAT,
  ADMIN_SETTINGS_DAYS_AHEAD,
  ADMIN_SETTINGS_DAYS_PER_ROW,
  ADMIN_SETTINGS_OFF,
  ADMIN_SETTINGS_ON,
} from './constants/admin-settings.constants';
import { AdminSettingsMessages } from './constants/admin-settings.messages';

@Injectable()
@BotSection({ access: BotAccess.OWNER, namespace: BotNamespace.ADMIN_SETTINGS })
export class AdminSettingsHandler implements BotHandler {
  private readonly logger = new Logger(AdminSettingsHandler.name);
  private readonly timeZone: string;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly aiService: AiService,
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
      case AdminSettingsAction.AI:
      case AdminSettingsAction.AI_COMMITS:
      case AdminSettingsAction.AI_COMMENTS:
        return this.switchAi(actor, locale, today, button.data.action, button.data.isOn);
    }
  }

  private async switchAi(
    actor: BotActor,
    locale: Locale,
    today: string,
    action: AdminSettingsAction,
    isOn: boolean,
  ) {
    const field = ADMIN_SETTINGS_AI_SWITCHES.find((item) => item.action === action)?.field;
    if (field) {
      await this.settingsService.update({ [field]: isOn });
      this.logger.log(
        { actorId: actor.user?.id ?? BotAccess.OWNER, [field]: isOn },
        AdminSettingsMessages.AI_CHANGED,
      );
    }
    return this.showMenu(locale, today);
  }

  private async showMenu(locale: Locale, today: string): Promise<BotReply> {
    const texts = locale.adminSettings;
    const settings = await this.settingsService.findOne();
    const pause = this.settingsService.toReportsPause(settings, today);
    const ai = this.settingsService.toAi(settings);
    const switches = this.aiService.isEnabled() ? ADMIN_SETTINGS_AI_SWITCHES : [];
    return {
      screen: {
        text: [
          texts.title,
          this.toState(locale, pause, today),
          texts.hint,
          '',
          ...(switches.length
            ? [
                texts.aiAlways,
                ...switches.map(
                  ({ text }) => `**${texts[text].name}** — ${texts[text].description}`,
                ),
              ]
            : [texts.aiNotConfigured]),
        ].join('\n'),
        buttons: [
          [{ text: texts.pauseToday, data: this.toData(AdminSettingsAction.TODAY) }],
          [{ text: texts.pauseUntil, data: this.toData(AdminSettingsAction.DAYS) }],
          [{ text: texts.pauseForever, data: this.toData(AdminSettingsAction.FOREVER) }],
          ...(pause
            ? [[{ text: texts.resume, data: this.toData(AdminSettingsAction.RESUME) }]]
            : []),
          ...switches.map(({ action, field, text }) => [
            this.toSwitchButton(texts, ai, action, field, text),
          ]),
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

  private toSwitchButton(
    texts: Locale['adminSettings'],
    ai: SettingsAi,
    action: AdminSettingsAction,
    field: keyof SettingsAi,
    text: 'ai' | 'aiCommits' | 'aiComments',
  ) {
    const isOn = ai[field];
    return {
      text: `${texts[text].name}: ${isOn ? texts.on : texts.off}`,
      data: this.toData(action, isOn ? ADMIN_SETTINGS_OFF : ADMIN_SETTINGS_ON),
    };
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
