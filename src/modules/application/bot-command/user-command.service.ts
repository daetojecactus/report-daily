import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { ReportQueueProducer } from 'src/modules/queue/report/report-queue.producer';
import {
  ALL_REPORT_HOURS,
  getUserBotCommands,
} from './constants/bot-command.constants';
import { BotCommandMessages } from './constants/bot-command.messages';
import {
  UserCallbackAction,
  CommandResult,
  InlineKeyboardMarkup,
} from './bot-command.types';
import { Language, getLocale } from 'src/common/i18n/i18n';
import {
  getRoleLabel,
  getStatusLabel,
  getTemplateLabel,
} from 'src/common/i18n/entity-labels';
import { formatDateToISO } from 'src/common/helpers/date.helper';
import { getErrorMessage } from 'src/common/helpers/error.helper';
import type { User } from '../user/user.schema';

@Injectable()
export class UserCommandService {
  private readonly logger = new Logger(UserCommandService.name);

  constructor(
    private readonly userService: UserService,
    private readonly reportQueueProducer: ReportQueueProducer,
  ) {}

  async handleInfo(user: User): Promise<CommandResult> {
    const lang = user.settings?.language ?? Language.RU;
    const locale = getLocale(lang);

    const lines = [
      `<b>${user.adminId}</b>`,
      ``,
      `<b>${locale.commands.role}:</b> ${getRoleLabel(user.role, locale)}`,
      `<b>${locale.commands.status}:</b> ${getStatusLabel(user.status, locale)}`,
      `<b>${locale.commands.reportHour}:</b> ${user.settings?.reportHour ?? '—'}:00`,
      `<b>${locale.commands.ai}:</b> ${user.settings?.useAI ? locale.commands.enable : locale.commands.disable}`,
      `<b>${locale.commands.template}:</b> ${getTemplateLabel(user.settings?.reportTemplate ?? 'Standard', locale)}`,
      `<b>${locale.commands.language}:</b> ${lang === Language.RU ? locale.commands.russian : locale.commands.english}`,
    ];

    return { text: lines.join('\n') };
  }

  async handleSendReport(user: User): Promise<CommandResult> {
    const lang = user.settings?.language ?? Language.RU;
    const locale = getLocale(lang);

    try {
      await this.reportQueueProducer.addReportJob({
        adminId: user.adminId,
        telegramId: user.telegramId,
        date: formatDateToISO(),
        language: lang,
      });
      return { text: locale.commands.reportQueued };
    } catch (error) {
      this.logger.error(
        `${BotCommandMessages.REPORT_QUEUE_ERROR}: ${user.adminId}: ${getErrorMessage(error)}`,
      );
      return {
        text: `${locale.admin.reportError}: ${getErrorMessage(error)}`,
      };
    }
  }

  async handleToggleAI(user: User): Promise<CommandResult> {
    const lang = user.settings?.language ?? Language.RU;
    const locale = getLocale(lang);
    const currentAI = user.settings?.useAI ?? false;

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: locale.commands.enable,
            callback_data: `${UserCallbackAction.TOGGLE_AI}:true`,
          },
          {
            text: locale.commands.disable,
            callback_data: `${UserCallbackAction.TOGGLE_AI}:false`,
          },
        ],
      ],
    };

    return {
      text: `${locale.commands.aiMode}: ${currentAI ? locale.commands.enable : locale.commands.disable}\n${locale.commands.selectOption}:`,
      keyboard,
    };
  }

  async handleChangeReportHour(user: User): Promise<CommandResult> {
    const lang = user.settings?.language ?? Language.RU;
    const locale = getLocale(lang);
    const currentHour = user.settings?.reportHour;

    const rows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < ALL_REPORT_HOURS.length; i += 6) {
      rows.push(
        ALL_REPORT_HOURS.slice(i, i + 6).map((hour) => ({
          text: currentHour === hour ? `> ${hour}:00` : `${hour}:00`,
          callback_data: `${UserCallbackAction.CHANGE_HOUR}:${hour}`,
        })),
      );
    }

    return {
      text: `${locale.commands.currentHour}: ${currentHour ?? '—'}:00\n${locale.commands.selectHour}:`,
      keyboard: { inline_keyboard: rows },
    };
  }

  async handleLanguage(user: User): Promise<CommandResult> {
    const lang = user.settings?.language ?? Language.RU;
    const locale = getLocale(lang);

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text:
              lang === Language.RU
                ? `> ${locale.commands.russian}`
                : locale.commands.russian,
            callback_data: `${UserCallbackAction.SET_LANGUAGE}:${Language.RU}`,
          },
          {
            text:
              lang === Language.EN
                ? `> ${locale.commands.english}`
                : locale.commands.english,
            callback_data: `${UserCallbackAction.SET_LANGUAGE}:${Language.EN}`,
          },
        ],
      ],
    };

    return {
      text: `${locale.commands.selectLanguage}:`,
      keyboard,
    };
  }

  async handleHelp(user: User): Promise<CommandResult> {
    const lang = user.settings?.language ?? Language.RU;
    const locale = getLocale(lang);

    const commands = getUserBotCommands(locale);
    const lines = commands.map((c) => `/${c.command} — ${c.description}`);

    return {
      text: `${locale.commands.availableCommands}:\n${lines.join('\n')}`,
    };
  }

  async handleUserCallback(
    telegramId: number,
    data: string,
  ): Promise<CommandResult | null> {
    const user = await this.userService.findOne({ telegramId });
    if (!user) return null;

    const lang = user.settings?.language ?? Language.RU;
    const locale = getLocale(lang);

    if (data.startsWith(UserCallbackAction.TOGGLE_AI)) {
      const value = data.split(':')[1];
      const useAI = value === 'true';
      await this.userService.updateUserSettings({ telegramId }, { useAI });
      return {
        text: useAI ? locale.commands.aiEnabled : locale.commands.aiDisabled,
      };
    }

    if (data.startsWith(UserCallbackAction.CHANGE_HOUR)) {
      const hour = Number(data.split(':')[1]);
      if (isNaN(hour) || hour < 0 || hour > 23) {
        return { text: locale.admin.parseError };
      }
      await this.userService.updateUserSettings(
        { telegramId },
        { reportHour: hour },
      );
      return { text: `${locale.commands.hourUpdated} ${hour}:00` };
    }

    if (data.startsWith(UserCallbackAction.SET_LANGUAGE)) {
      const newLang = data.split(':')[1] as Language;
      if (!Object.values(Language).includes(newLang)) {
        return { text: locale.admin.parseError };
      }
      await this.userService.updateUserSettings(
        { telegramId },
        { language: newLang },
      );
      const newLocale = getLocale(newLang);
      return {
        text: `${newLocale.commands.languageUpdated} ${newLang === Language.RU ? newLocale.commands.russian : newLocale.commands.english}`,
      };
    }

    return null;
  }
}
