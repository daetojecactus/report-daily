import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { UserService } from 'src/modules/application/user/user.service';
import { SchedulerService } from 'src/modules/application/scheduler/scheduler.service';
import { BotCommandService } from 'src/modules/application/bot-command/bot-command.service';
import { BotCommandSetupService } from 'src/modules/application/bot-command/bot-command-setup.service';
import { UserCommandService } from 'src/modules/application/bot-command/user-command.service';
import {
  getOwnerBotCommands,
  getUserBotCommands,
  TEST_REPORT_MARKER,
} from 'src/modules/application/bot-command/constants/bot-command.constants';
import { BotCommandMessages } from 'src/modules/application/bot-command/constants/bot-command.messages';
import {
  USER_COMMANDS,
  USER_CALLBACK_PREFIXES,
} from './constants/telegram-command-router.constants';
import type { ReportDailyBotEnvs } from 'src/modules/infrastructure/config/env';
import {
  BotCallbackAction,
  BotCommand,
  CallbackDataPrefix,
  UserCallbackAction,
} from 'src/modules/application/bot-command/bot-command.enums';
import type { CommandResult } from 'src/modules/application/bot-command/bot-command.interface';
import { Language, getLocale } from 'src/common/i18n/i18n';
import { formatDateToISO } from 'src/common/helpers/date.helper';
import { getErrorMessage } from 'src/common/helpers/error.helper';
import type { User } from 'src/modules/application/user/user.schema';

@Injectable()
export class TelegramCommandRouter {
  private readonly ownerTelegramId: number;

  constructor(
    private readonly telegramService: TelegramService,
    private readonly userService: UserService,
    private readonly botCommandService: BotCommandService,
    private readonly botCommandSetupService: BotCommandSetupService,
    private readonly userCommandService: UserCommandService,
    private readonly schedulerService: SchedulerService,
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {
    this.ownerTelegramId = this.configService.get('OWNER_TELEGRAM_ID');
  }

  isOwner(telegramId: number): boolean {
    return telegramId === this.ownerTelegramId;
  }

  isUserCallback(data: string): boolean {
    return USER_CALLBACK_PREFIXES.some((prefix) => data.startsWith(prefix));
  }

  private async getOwnerLanguage(): Promise<Language> {
    const owner = await this.userService.findOne({
      telegramId: this.ownerTelegramId,
    });
    return owner?.settings?.language ?? Language.RU;
  }

  async handleCallbackQuery(
    telegramId: number,
    chatId: number,
    callbackId: string,
    data: string,
  ): Promise<string | null> {
    await this.telegramService.answerCallbackQuery(callbackId);

    if (this.isUserCallback(data)) {
      const result = await this.userCommandService.handleUserCallback(
        telegramId,
        data,
      );
      if (result) {
        await this.sendResult(chatId, result);

        if (data.startsWith(UserCallbackAction.SET_LANGUAGE)) {
          const lang = data.split(':')[1] as Language;
          if (Object.values(Language).includes(lang)) {
            const locale = getLocale(lang);
            const commands = this.isOwner(telegramId)
              ? getOwnerBotCommands(locale)
              : getUserBotCommands(locale);
            await this.telegramService.setCommandsForChat(chatId, commands);
          }
        }
      } else {
        const locale = getLocale(Language.RU);
        await this.telegramService.sendMessageTo(
          chatId,
          locale.commands.notRegistered,
        );
      }
      return null;
    }

    if (!this.isOwner(telegramId)) return null;

    const language = await this.getOwnerLanguage();
    let result: CommandResult;

    if (
      data === BotCallbackAction.BROADCAST_CONFIRM ||
      data === BotCallbackAction.BROADCAST_CANCEL
    ) {
      result = await this.botCommandService.handleBroadcastCallback(
        telegramId,
        data,
        language,
      );
    } else if (data.startsWith(`${CallbackDataPrefix.UPDATE_FIELD}:`)) {
      result = await this.botCommandService.handleFieldCallback(data, language);
    } else if (data.startsWith(`${CallbackDataPrefix.UPDATE_VALUE}:`)) {
      result = await this.botCommandService.handleValueCallback(data, language);
    } else {
      result = await this.botCommandService.handleCallback(data, language);
    }

    if (result.text.startsWith(TEST_REPORT_MARKER)) {
      return result.text.slice(TEST_REPORT_MARKER.length);
    }

    await this.sendResult(chatId, result);
    return null;
  }

  async handleTextMessage(
    telegramId: number,
    chatId: number,
    text: string | undefined,
  ): Promise<CommandResult | null> {
    const isOwner = this.isOwner(telegramId);

    if (text?.toLowerCase().startsWith(BotCommand.START)) {
      const user = await this.userService.findOne({ telegramId });
      if (user) {
        const lang = user.settings?.language ?? Language.RU;
        const locale = getLocale(lang);
        //гарантируем актуальное меню команд при первом входе пользователя
        await this.botCommandSetupService.syncCommandsForTelegramId(
          telegramId,
          lang,
        );
        await this.telegramService.sendMessageTo(
          chatId,
          locale.commands.welcome,
        );
      }
      return null;
    }

    if (isOwner && text && !text.startsWith('/')) {
      if (this.botCommandService.hasActiveInputSession(telegramId)) {
        const language = await this.getOwnerLanguage();
        const result = await this.botCommandService.handleTextInput(
          telegramId,
          text,
          language,
        );
        if (result) {
          await this.sendResult(chatId, result);
          return null;
        }
      }
    }

    if (!text?.startsWith('/')) return null;

    const command = text.trim().split(/\s+/)[0]?.toLowerCase();

    if (command && USER_COMMANDS.has(command)) {
      const user = await this.userService.findOne({ telegramId });
      if (!user) {
        const locale = getLocale(Language.RU);
        await this.telegramService.sendMessageTo(
          chatId,
          locale.commands.notRegistered,
        );
        return null;
      }

      const result = await this.routeUserCommand(command, user);
      await this.sendResult(chatId, result);
      return null;
    }

    if (command === BotCommand.HELP) {
      if (isOwner) {
        const language = await this.getOwnerLanguage();
        const result = await this.botCommandService.handleCommand(
          text,
          language,
        );
        await this.sendResult(chatId, result);
      } else {
        const user = await this.userService.findOne({ telegramId });
        if (!user) {
          const locale = getLocale(Language.RU);
          await this.telegramService.sendMessageTo(
            chatId,
            locale.commands.notRegistered,
          );
          return null;
        }
        const result = await this.userCommandService.handleHelp(user);
        await this.sendResult(chatId, result);
      }
      return null;
    }

    if (!isOwner) return null;

    const language = await this.getOwnerLanguage();

    if (command === BotCommand.ADD_USER) {
      const [, ...args] = text.trim().split(/\s+/);
      const result = await this.botCommandService.startAddUserWizard(
        args,
        telegramId,
        language,
      );
      await this.sendResult(chatId, result);
      return null;
    }

    if (command === BotCommand.BROADCAST) {
      const result = this.botCommandService.startBroadcastWizard(
        telegramId,
        language,
      );
      await this.sendResult(chatId, result);
      return null;
    }

    const result = await this.botCommandService.handleCommand(text, language);
    await this.sendResult(chatId, result);
    return null;
  }

  async sendResult(chatId: number, result: CommandResult): Promise<void> {
    if (result.keyboard) {
      await this.telegramService.sendMessageWithKeyboard(
        chatId,
        result.text,
        result.keyboard,
      );
    } else {
      await this.telegramService.sendMessageTo(chatId, result.text);
    }
  }

  private async routeUserCommand(
    command: string,
    user: User,
  ): Promise<CommandResult> {
    switch (command) {
      case BotCommand.INFO:
        return this.userCommandService.handleInfo(user);
      case BotCommand.SEND_REPORT:
        return this.userCommandService.handleSendReport(user);
      case BotCommand.TOGGLE_AI:
        return this.userCommandService.handleToggleAI(user);
      case BotCommand.CHANGE_REPORT_HOUR:
        return this.userCommandService.handleChangeReportHour(user);
      case BotCommand.LANGUAGE:
        return this.userCommandService.handleLanguage(user);
      default: {
        const lang = user.settings?.language ?? Language.RU;
        const locale = getLocale(lang);
        return { text: locale.admin.unknownCommand };
      }
    }
  }

  //синхронная генерация и отправка отчёта по конкретному пользователю (send_user_report)
  async executeTestReport(chatId: number, adminId: string): Promise<void> {
    const date = formatDateToISO();

    try {
      await this.telegramService.sendMessageTo(
        chatId,
        `${BotCommandMessages.REPORT_GENERATING} ${adminId} (${date})...`,
      );
      await this.schedulerService.sendReportForUser(adminId, date);
      await this.telegramService.sendMessageTo(
        chatId,
        `${BotCommandMessages.REPORT_SENT}: ${adminId} (${date})`,
      );
    } catch (error) {
      await this.telegramService.sendMessageTo(
        chatId,
        `${BotCommandMessages.REPORT_ERROR}: ${getErrorMessage(error)}`,
      );
    }
  }
}
