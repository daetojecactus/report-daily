import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScreenButtonStyle } from 'src/common/channel/types/screen.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ScreenButton } from 'src/common/channel/types/chat-channel.interface';
import { addDays, getToday } from 'src/common/utils/date.util';
import { AiService } from 'src/modules/application/ai/ai.service';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
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
  ADMIN_SETTINGS_CONFIRM,
  ADMIN_SETTINGS_DAY_BUTTON_FORMAT,
  ADMIN_SETTINGS_DAYS_AHEAD,
  ADMIN_SETTINGS_DAYS_PER_ROW,
  ADMIN_SETTINGS_OFF,
  ADMIN_SETTINGS_ON,
} from './constants/admin-settings.constants';
import { AdminSettingsMessages } from './constants/admin-settings.messages';
import { AdminSettingsView } from './admin-settings.view';

@Injectable()
@BotSection({ access: BotAccess.OWNER, namespace: BotNamespace.ADMIN_SETTINGS })
export class AdminSettingsHandler implements BotHandler {
  private readonly logger = new Logger(AdminSettingsHandler.name);
  private readonly timeZone: string;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly aiService: AiService,
    private readonly adminSettingsView: AdminSettingsView,
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
    const { data } = button;
    switch (data.action) {
      case AdminSettingsAction.MENU:
        return this.showMenu(locale, today);
      case AdminSettingsAction.PAUSE:
        return this.showPause(locale, today);
      case AdminSettingsAction.DAYS:
        return this.showDays(locale, today);
      case AdminSettingsAction.TODAY:
        return data.isConfirmed
          ? this.pause(actor, locale, today, today)
          : this.confirmPause(locale, data.action);
      case AdminSettingsAction.UNTIL:
        return this.isAhead(data.date, today)
          ? this.pause(actor, locale, today, data.date)
          : { screen: { text: locale.bot.expired } };
      case AdminSettingsAction.FOREVER:
        return data.isConfirmed
          ? this.pause(actor, locale, today, null)
          : this.confirmPause(locale, data.action);
      case AdminSettingsAction.RESUME:
        return data.isConfirmed
          ? this.resume(actor, locale, today)
          : this.confirmPause(locale, data.action);
      case AdminSettingsAction.AI:
      case AdminSettingsAction.AI_COMMITS:
      case AdminSettingsAction.AI_COMMENTS:
        if (!this.aiService.isEnabled()) {
          return { screen: { text: locale.bot.expired } };
        }
        return data.isConfirmed
          ? this.switchAi(actor, locale, today, data.action, data.isOn)
          : this.confirmAi(locale, data.action, data.isOn);
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
          `${texts.reports}: ${this.adminSettingsView.toPauseState(locale, pause, today)}`,
          ...(switches.length
            ? switches.map(
                ({ field, text }) => `${texts[text].name}: ${ai[field] ? texts.on : texts.off}`,
              )
            : [texts.aiNotConfigured]),
        ].join('\n'),
        buttons: [
          [{ text: texts.pause, data: this.toData(AdminSettingsAction.PAUSE) }],
          ...switches.map(({ action, field, text }) => [
            {
              text: texts[text].name,
              data: this.toData(action, ai[field] ? ADMIN_SETTINGS_OFF : ADMIN_SETTINGS_ON),
            },
          ]),
          [{ text: texts.menu, data: ADMIN_MENU_DATA }],
        ],
      },
      dialog: null,
    };
  }

  private async showPause(locale: Locale, today: string): Promise<BotReply> {
    const texts = locale.adminSettings;
    const pause = this.settingsService.toReportsPause(await this.settingsService.findOne(), today);
    return {
      screen: {
        text: [
          `**${texts.pause}**`,
          texts.pauseHint,
          texts.now(this.adminSettingsView.toPauseState(locale, pause, today)),
        ].join('\n'),
        buttons: [
          [
            { text: texts.pauseToday, data: this.toData(AdminSettingsAction.TODAY) },
            { text: texts.pauseUntil, data: this.toData(AdminSettingsAction.DAYS) },
            { text: texts.pauseForever, data: this.toData(AdminSettingsAction.FOREVER) },
          ],
          ...(pause
            ? [[{ text: texts.resume, data: this.toData(AdminSettingsAction.RESUME) }]]
            : []),
          [{ text: texts.back, data: this.toData(AdminSettingsAction.MENU) }],
        ],
      },
      dialog: null,
    };
  }

  private confirmPause(
    locale: Locale,
    action: AdminSettingsAction.TODAY | AdminSettingsAction.FOREVER | AdminSettingsAction.RESUME,
  ): BotReply {
    const texts = locale.adminSettings;
    const description = {
      [AdminSettingsAction.TODAY]: texts.confirmToday,
      [AdminSettingsAction.FOREVER]: texts.confirmForever,
      [AdminSettingsAction.RESUME]: texts.confirmResume,
    }[action];
    return {
      screen: {
        text: [`**${texts.pause}**`, description].join('\n'),
        buttons: [
          [
            {
              text: action === AdminSettingsAction.RESUME ? texts.resume : texts.setPause,
              data: this.toData(action, ADMIN_SETTINGS_CONFIRM),
              style:
                action === AdminSettingsAction.RESUME
                  ? ScreenButtonStyle.PRIMARY
                  : ScreenButtonStyle.DANGER,
            },
            { text: texts.back, data: this.toData(AdminSettingsAction.PAUSE) },
          ],
        ],
      },
      dialog: null,
    };
  }

  private confirmAi(locale: Locale, action: AdminSettingsAction, isOn: boolean): BotReply {
    const texts = locale.adminSettings;
    const text = ADMIN_SETTINGS_AI_SWITCHES.find((item) => item.action === action)?.text ?? 'ai';
    return {
      screen: {
        text: [
          `**${texts[text].name}**`,
          texts[text].description,
          texts.now(isOn ? texts.off : texts.on),
        ].join('\n'),
        buttons: [
          [
            {
              text: isOn ? texts.turnOn : texts.turnOff,
              data: this.toData(
                action,
                isOn ? ADMIN_SETTINGS_ON : ADMIN_SETTINGS_OFF,
                ADMIN_SETTINGS_CONFIRM,
              ),
              style: isOn ? ScreenButtonStyle.PRIMARY : ScreenButtonStyle.DANGER,
            },
            { text: texts.back, data: this.toData(AdminSettingsAction.MENU) },
          ],
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
        text: format.format(this.adminSettingsView.toInstant(date)),
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
          [{ text: locale.adminSettings.back, data: this.toData(AdminSettingsAction.PAUSE) }],
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
    return this.showPause(locale, today);
  }

  private async resume(actor: BotActor, locale: Locale, today: string): Promise<BotReply> {
    await this.settingsService.resumeReports();
    this.logger.log({ actorId: actor.user?.id ?? BotAccess.OWNER }, AdminSettingsMessages.RESUMED);
    return this.showPause(locale, today);
  }

  private isAhead(date: string, today: string) {
    return date > today && date <= addDays(today, ADMIN_SETTINGS_DAYS_AHEAD);
  }

  private toData(...parts: string[]) {
    return [BotNamespace.ADMIN_SETTINGS, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
