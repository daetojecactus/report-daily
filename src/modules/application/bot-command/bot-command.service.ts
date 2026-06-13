import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { BotCommandSetupService } from './bot-command-setup.service';
import { UserRole, UserStatus, ReportTemplate } from '../user/user.interface';
import {
  getOwnerBotCommands,
  REPORT_HOURS,
  VALID_ROLES,
  VALID_STATUSES,
  TEST_REPORT_MARKER,
} from './constants/bot-command.constants';
import {
  AddUserStep,
  BotCallbackAction,
  BotCommand,
  BroadcastStep,
  CallbackDataPrefix,
  CommandResult,
  InlineKeyboardMarkup,
  UserField,
} from './bot-command.types';
import { getErrorMessage } from 'src/common/helpers/error.helper';
import { Language, getLocale } from 'src/common/i18n/i18n';
import type { Locale } from 'src/common/i18n/i18n.types';
import {
  getRoleLabel,
  getStatusLabel,
  getTemplateLabel,
  getGenderLabel,
} from 'src/common/i18n/entity-labels';
import { BroadcastQueueProducer } from 'src/modules/queue/broadcast/broadcast-queue.producer';

interface AddUserSession {
  step: AddUserStep;
  adminId?: string;
  telegramId?: number;
  role?: UserRole;
}

//сессия визарда рассылки
interface BroadcastSession {
  step: BroadcastStep;
  text?: string;
}

@Injectable()
export class BotCommandService {
  private readonly logger = new Logger(BotCommandService.name);
  private addUserSessions = new Map<number, AddUserSession>();
  private broadcastSessions = new Map<number, BroadcastSession>();

  constructor(
    private readonly userService: UserService,
    private readonly botCommandSetupService: BotCommandSetupService,
    private readonly broadcastQueueProducer: BroadcastQueueProducer,
  ) {}

  hasActiveInputSession(ownerTelegramId: number): boolean {
    return (
      this.addUserSessions.has(ownerTelegramId) ||
      this.broadcastSessions.has(ownerTelegramId)
    );
  }

  async handleTextInput(
    ownerTelegramId: number,
    text: string,
    language: Language,
  ): Promise<CommandResult | null> {
    const locale = getLocale(language);

    const broadcastSession = this.broadcastSessions.get(ownerTelegramId);
    if (broadcastSession?.step === BroadcastStep.TEXT) {
      return this.handleBroadcastTextInput(ownerTelegramId, text, locale);
    }

    const session = this.addUserSessions.get(ownerTelegramId);
    if (!session) return null;

    if (session.step === AddUserStep.ADMIN_ID) {
      const adminId = text.trim();
      if (!adminId || adminId.includes(' ')) {
        return {
          text: `${locale.admin.invalidArgs}: ${locale.admin.adminIdNoSpaces}`,
        };
      }
      session.adminId = adminId;
      session.step = AddUserStep.TELEGRAM_ID;
      return { text: locale.admin.enterTelegramId };
    }

    if (session.step === AddUserStep.TELEGRAM_ID) {
      const telegramId = Number(text.trim());
      if (isNaN(telegramId) || telegramId <= 0) {
        return {
          text: `${locale.admin.invalidArgs}: ${locale.admin.telegramIdMustBeNumber}`,
        };
      }
      session.telegramId = telegramId;
      session.step = AddUserStep.ROLE;
      return this.showAddUserRoleMenu(locale);
    }

    return null;
  }

  async handleCommand(
    text: string,
    language: Language,
  ): Promise<CommandResult> {
    const [command, ...args] = text.trim().split(/\s+/);
    const locale = getLocale(language);

    switch (command?.toLowerCase()) {
      case BotCommand.ADD_USER:
        return this.startAddUserWizard(args, undefined, language);
      case BotCommand.UPDATE_USER:
        return this.showUpdateUserMenu(args, locale);
      case BotCommand.BLOCK_USER:
        return this.showUserSelectMenu(
          BotCallbackAction.BLOCK_USER,
          locale.admin.selectUserBlock,
          locale,
        );
      case BotCommand.UNBLOCK_USER:
        return this.showUserSelectMenu(
          BotCallbackAction.UNBLOCK_USER,
          locale.admin.selectUserUnblock,
          locale,
        );
      case BotCommand.USER_INFO:
        return this.showUserSelectMenu(
          BotCallbackAction.USER_INFO,
          locale.admin.selectUserInfo,
          locale,
        );
      case BotCommand.SEND_USER_REPORT:
        return this.showUserSelectMenu(
          BotCallbackAction.TEST_REPORT,
          locale.admin.selectUserReport,
          locale,
        );
      case BotCommand.LIST_USERS:
        return { text: await this.listUsers(locale) };
      case BotCommand.HELP:
        return { text: this.buildHelp(locale) };
      default:
        return { text: locale.admin.unknownCommand };
    }
  }

  async handleCallback(
    data: string,
    language: Language,
  ): Promise<CommandResult> {
    const locale = getLocale(language);
    const parsed = this.parseCallback(data);
    if (!parsed) return { text: locale.admin.unknownAction };

    switch (parsed.action) {
      case BotCallbackAction.USER_INFO:
        return { text: await this.getUserInfo(parsed.adminId, locale) };
      case BotCallbackAction.BLOCK_USER:
        return {
          text: await this.setUserStatus(
            parsed.adminId,
            UserStatus.BLOCKED,
            locale,
          ),
        };
      case BotCallbackAction.UNBLOCK_USER:
        return {
          text: await this.setUserStatus(
            parsed.adminId,
            UserStatus.ACTIVE,
            locale,
          ),
        };
      case BotCallbackAction.TEST_REPORT:
        return { text: `${TEST_REPORT_MARKER}${parsed.adminId}` };
      case BotCallbackAction.UPDATE_USER:
        return this.showUpdateFieldMenu(parsed.adminId, locale);
      case BotCallbackAction.ADD_USER_ROLE:
        return this.handleAddUserRole(parsed.adminId, undefined, locale);
      case BotCallbackAction.ADD_USER_HOUR:
        return this.handleAddUserHour(parsed.adminId, undefined, locale);
      default:
        return { text: locale.admin.unknownAction };
    }
  }

  async handleFieldCallback(
    data: string,
    language: Language,
  ): Promise<CommandResult> {
    const locale = getLocale(language);
    const parts = data.split(':');
    if (parts.length < 3) return { text: locale.admin.parseError };

    const [, adminId, field] = parts;

    switch (field) {
      case UserField.ROLE:
        return this.showRoleSelectMenu(adminId, locale);
      case UserField.STATUS:
        return this.showStatusSelectMenu(adminId, locale);
      case UserField.REPORT_HOUR:
        return this.showHourSelectMenu(adminId, locale);
      case UserField.USE_AI:
        return this.showAISelectMenu(adminId, locale);
      case UserField.REPORT_TEMPLATE:
        return this.showTemplateSelectMenu(adminId, locale);
      case UserField.LANGUAGE:
        return this.showLanguageSelectMenu(adminId, locale);
      default:
        return { text: locale.admin.unknownField };
    }
  }

  async handleValueCallback(
    data: string,
    language: Language,
  ): Promise<CommandResult> {
    const locale = getLocale(language);
    const parts = data.split(':');
    if (parts.length < 4) return { text: locale.admin.parseError };

    const [, adminId, field, value] = parts;

    try {
      switch (field) {
        case UserField.ROLE:
          await this.userService.updateOne(
            { adminId },
            { role: value as UserRole },
          );
          break;
        case UserField.STATUS:
          await this.userService.updateOne(
            { adminId },
            { status: value as UserStatus },
          );
          break;
        case UserField.REPORT_HOUR:
          await this.userService.updateUserSettings(
            { adminId },
            { reportHour: Number(value) },
          );
          break;
        case UserField.USE_AI:
          await this.userService.updateUserSettings(
            { adminId },
            { useAI: value === 'true' },
          );
          break;
        case UserField.REPORT_TEMPLATE:
          await this.userService.updateUserSettings(
            { adminId },
            { reportTemplate: value as ReportTemplate },
          );
          break;
        case UserField.LANGUAGE:
          await this.userService.updateUserSettings(
            { adminId },
            { language: value as Language },
          );
          break;
      }
      return {
        text: `${locale.admin.userUpdated}: ${adminId} (${field} = ${value})`,
      };
    } catch (error) {
      return {
        text: `${locale.admin.updateError}: ${getErrorMessage(error)}`,
      };
    }
  }

  async startAddUserWizard(
    args: string[],
    ownerTelegramId?: number,
    language: Language = Language.RU,
  ): Promise<CommandResult> {
    const locale = getLocale(language);

    if (args.length >= 4) {
      return this.addUserDirect(args, locale);
    }

    if (ownerTelegramId) {
      this.addUserSessions.set(ownerTelegramId, { step: AddUserStep.ADMIN_ID });
    }
    return { text: locale.admin.enterAdminId };
  }

  //старт визарда рассылки: запрашиваем текст сообщения
  startBroadcastWizard(
    ownerTelegramId: number,
    language: Language = Language.RU,
  ): CommandResult {
    const locale = getLocale(language);
    this.broadcastSessions.set(ownerTelegramId, { step: BroadcastStep.TEXT });
    return { text: locale.admin.broadcastEnterText };
  }

  //обработка введённого текста рассылки: показываем предпросмотр с кнопками
  private handleBroadcastTextInput(
    ownerTelegramId: number,
    text: string,
    locale: Locale,
  ): CommandResult {
    const message = text.trim();
    if (!message) {
      return { text: locale.admin.broadcastEmpty };
    }

    const session = this.broadcastSessions.get(ownerTelegramId);
    if (!session) return { text: locale.admin.parseError };

    session.text = message;
    session.step = BroadcastStep.CONFIRM;

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: locale.admin.broadcastSend,
            callback_data: BotCallbackAction.BROADCAST_CONFIRM,
          },
          {
            text: locale.admin.broadcastCancel,
            callback_data: BotCallbackAction.BROADCAST_CANCEL,
          },
        ],
      ],
    };

    return {
      text: `${locale.admin.broadcastPreview}:\n\n${message}`,
      keyboard,
    };
  }

  //обработка кнопок предпросмотра рассылки (отправить / отмена)
  async handleBroadcastCallback(
    ownerTelegramId: number,
    data: string,
    language: Language,
  ): Promise<CommandResult> {
    const locale = getLocale(language);
    const session = this.broadcastSessions.get(ownerTelegramId);

    if (data === BotCallbackAction.BROADCAST_CANCEL) {
      this.broadcastSessions.delete(ownerTelegramId);
      return { text: locale.admin.broadcastCancelled };
    }

    if (data !== BotCallbackAction.BROADCAST_CONFIRM) {
      return { text: locale.admin.unknownAction };
    }

    const message = session?.text?.trim();
    this.broadcastSessions.delete(ownerTelegramId);

    if (!message) {
      return { text: locale.admin.broadcastEmpty };
    }

    return this.enqueueBroadcast(message, locale);
  }

  //ставит рассылку в очередь всем активным получателям
  private async enqueueBroadcast(
    message: string,
    locale: Locale,
  ): Promise<CommandResult> {
    const users = await this.userService.find({ status: UserStatus.ACTIVE });
    const recipients = (users ?? []).filter((user) => user.telegramId);

    if (recipients.length === 0) {
      return { text: locale.admin.broadcastNoRecipients };
    }

    try {
      await this.broadcastQueueProducer.addBatchBroadcastJobs(
        recipients.map((user) => ({
          telegramId: user.telegramId,
          text: message,
        })),
      );
      return {
        text: `${locale.admin.broadcastQueued} ${recipients.length}`,
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      this.logger.error(`Broadcast enqueue failed: ${msg}`);
      return { text: `${locale.admin.reportError}: ${msg}` };
    }
  }

  private async addUserDirect(
    args: string[],
    locale: Locale,
  ): Promise<CommandResult> {
    const [adminId, tgIdStr, role, hourStr] = args;
    const telegramId = Number(tgIdStr);
    const reportHour = Number(hourStr);

    if (isNaN(telegramId) || isNaN(reportHour)) {
      return {
        text: `${locale.admin.invalidArgs}: ${locale.admin.telegramIdAndHourMustBeNumbers}`,
      };
    }

    if (!VALID_ROLES.includes(role)) {
      return {
        text: `${locale.admin.invalidArgs}: ${locale.admin.validRoles} — ${VALID_ROLES.join(', ')}`,
      };
    }

    try {
      const user = await this.userService.createUser({
        adminId,
        telegramId,
        role: role as UserRole,
        reportHour,
      });
      await this.botCommandSetupService.syncAllCommandsSafe();
      return { text: `${locale.admin.userCreated}: ${user.adminId}` };
    } catch (error) {
      const msg = getErrorMessage(error);
      this.logger.error(`${locale.admin.createError}: ${msg}`);
      return { text: `${locale.admin.createError}: ${msg}` };
    }
  }

  private showAddUserRoleMenu(locale: Locale): CommandResult {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: VALID_ROLES.map((role) => [
        {
          text: role,
          callback_data: `${BotCallbackAction.ADD_USER_ROLE}:${role}`,
        },
      ]),
    };
    return { text: locale.admin.selectRoleWizard, keyboard };
  }

  handleAddUserRole(
    role: string,
    ownerTelegramId?: number,
    locale?: Locale,
  ): CommandResult {
    const l = locale ?? getLocale(Language.RU);
    const entry = ownerTelegramId
      ? this.addUserSessions.get(ownerTelegramId)
      : this.findSessionByStep(AddUserStep.ROLE);
    if (!entry || entry.step !== AddUserStep.ROLE) {
      return { text: l.admin.parseError };
    }
    entry.role = role as UserRole;
    entry.step = AddUserStep.HOUR;

    const rows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < REPORT_HOURS.length; i += 4) {
      rows.push(
        REPORT_HOURS.slice(i, i + 4).map((hour) => ({
          text: `${hour}:00`,
          callback_data: `${BotCallbackAction.ADD_USER_HOUR}:${hour}`,
        })),
      );
    }

    return {
      text: l.admin.selectHourWizard,
      keyboard: { inline_keyboard: rows },
    };
  }

  async handleAddUserHour(
    hourStr: string,
    ownerTelegramId?: number,
    locale?: Locale,
  ): Promise<CommandResult> {
    const l = locale ?? getLocale(Language.RU);
    const entry = ownerTelegramId
      ? this.addUserSessions.get(ownerTelegramId)
      : this.findSessionByStep(AddUserStep.HOUR);
    if (!entry || entry.step !== AddUserStep.HOUR) {
      return { text: l.admin.parseError };
    }

    const reportHour = Number(hourStr);
    const { adminId, telegramId, role } = entry;

    for (const [key, val] of this.addUserSessions.entries()) {
      if (val === entry) this.addUserSessions.delete(key);
    }

    if (!adminId || !telegramId || !role) {
      return { text: l.admin.parseError };
    }

    try {
      const user = await this.userService.createUser({
        adminId,
        telegramId,
        role,
        reportHour,
      });
      await this.botCommandSetupService.syncAllCommandsSafe();
      return { text: `${l.admin.userCreated}: ${user.adminId}` };
    } catch (error) {
      const msg = getErrorMessage(error);
      this.logger.error(`${l.admin.createError}: ${msg}`);
      return { text: `${l.admin.createError}: ${msg}` };
    }
  }

  private findSessionByStep(step: AddUserStep): AddUserSession | undefined {
    for (const session of this.addUserSessions.values()) {
      if (session.step === step) return session;
    }
    return undefined;
  }

  private async showUserSelectMenu(
    action: BotCallbackAction,
    title: string,
    locale: Locale,
  ): Promise<CommandResult> {
    const users = await this.userService.find();
    if (!users?.length) return { text: title };

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: users.map((user) => [
        {
          text: `${user.adminId} (${getRoleLabel(user.role, locale)})`,
          callback_data: `${action}:${user.adminId}`,
        },
      ]),
    };

    return { text: title, keyboard };
  }

  private async showUpdateUserMenu(
    args: string[],
    locale: Locale,
  ): Promise<CommandResult> {
    if (args.length >= 1) {
      const adminId = args[0];
      const user = await this.userService.findOne({ adminId });
      if (!user) return { text: locale.admin.userNotFound };
      return this.showUpdateFieldMenu(adminId, locale);
    }
    return this.showUserSelectMenu(
      BotCallbackAction.UPDATE_USER,
      locale.admin.selectUserUpdate,
      locale,
    );
  }

  private showUpdateFieldMenu(adminId: string, locale: Locale): CommandResult {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: locale.commands.role,
            callback_data: `${CallbackDataPrefix.UPDATE_FIELD}:${adminId}:${UserField.ROLE}`,
          },
          {
            text: locale.commands.status,
            callback_data: `${CallbackDataPrefix.UPDATE_FIELD}:${adminId}:${UserField.STATUS}`,
          },
        ],
        [
          {
            text: locale.commands.reportHour,
            callback_data: `${CallbackDataPrefix.UPDATE_FIELD}:${adminId}:${UserField.REPORT_HOUR}`,
          },
          {
            text: locale.commands.ai,
            callback_data: `${CallbackDataPrefix.UPDATE_FIELD}:${adminId}:${UserField.USE_AI}`,
          },
        ],
        [
          {
            text: locale.commands.template,
            callback_data: `${CallbackDataPrefix.UPDATE_FIELD}:${adminId}:${UserField.REPORT_TEMPLATE}`,
          },
          {
            text: locale.commands.language,
            callback_data: `${CallbackDataPrefix.UPDATE_FIELD}:${adminId}:${UserField.LANGUAGE}`,
          },
        ],
      ],
    };
    return {
      text: `${locale.admin.selectField} (${adminId}):`,
      keyboard,
    };
  }

  private showRoleSelectMenu(adminId: string, locale: Locale): CommandResult {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: VALID_ROLES.map((role) => [
        {
          text: getRoleLabel(role, locale),
          callback_data: `${CallbackDataPrefix.UPDATE_VALUE}:${adminId}:${UserField.ROLE}:${role}`,
        },
      ]),
    };
    return {
      text: `${locale.admin.selectRole} (${adminId}):`,
      keyboard,
    };
  }

  private showStatusSelectMenu(adminId: string, locale: Locale): CommandResult {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: VALID_STATUSES.map((status) => [
        {
          text: getStatusLabel(status, locale),
          callback_data: `${CallbackDataPrefix.UPDATE_VALUE}:${adminId}:${UserField.STATUS}:${status}`,
        },
      ]),
    };
    return {
      text: `${locale.admin.selectStatus} (${adminId}):`,
      keyboard,
    };
  }

  private showHourSelectMenu(adminId: string, locale: Locale): CommandResult {
    const rows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < REPORT_HOURS.length; i += 4) {
      rows.push(
        REPORT_HOURS.slice(i, i + 4).map((hour) => ({
          text: `${hour}:00`,
          callback_data: `${CallbackDataPrefix.UPDATE_VALUE}:${adminId}:${UserField.REPORT_HOUR}:${hour}`,
        })),
      );
    }
    return {
      text: `${locale.admin.selectHour} (${adminId}):`,
      keyboard: { inline_keyboard: rows },
    };
  }

  private showAISelectMenu(adminId: string, locale: Locale): CommandResult {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: locale.commands.enable,
            callback_data: `${CallbackDataPrefix.UPDATE_VALUE}:${adminId}:${UserField.USE_AI}:true`,
          },
          {
            text: locale.commands.disable,
            callback_data: `${CallbackDataPrefix.UPDATE_VALUE}:${adminId}:${UserField.USE_AI}:false`,
          },
        ],
      ],
    };
    return {
      text: `${locale.commands.ai} (${adminId}):`,
      keyboard,
    };
  }

  private showTemplateSelectMenu(
    adminId: string,
    locale: Locale,
  ): CommandResult {
    const templates = Object.values(ReportTemplate);
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: templates.map((template) => [
        {
          text: getTemplateLabel(template, locale),
          callback_data: `${CallbackDataPrefix.UPDATE_VALUE}:${adminId}:${UserField.REPORT_TEMPLATE}:${template}`,
        },
      ]),
    };
    return {
      text: `${locale.admin.selectTemplate} (${adminId}):`,
      keyboard,
    };
  }

  private showLanguageSelectMenu(
    adminId: string,
    locale: Locale,
  ): CommandResult {
    const languages = Object.values(Language);
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: languages.map((lang) => [
        {
          text:
            lang === Language.RU
              ? locale.commands.russian
              : locale.commands.english,
          callback_data: `${CallbackDataPrefix.UPDATE_VALUE}:${adminId}:${UserField.LANGUAGE}:${lang}`,
        },
      ]),
    };
    return {
      text: `${locale.admin.selectLanguage} (${adminId}):`,
      keyboard,
    };
  }

  private parseCallback(
    data: string,
  ): { action: BotCallbackAction; adminId: string } | null {
    const parts = data.split(':');
    if (parts.length < 2) return null;

    const [action, adminId] = parts;
    if (!Object.values(BotCallbackAction).includes(action as BotCallbackAction))
      return null;

    return { action: action as BotCallbackAction, adminId };
  }

  private async setUserStatus(
    adminId: string,
    status: UserStatus,
    locale: Locale,
  ): Promise<string> {
    try {
      await this.userService.updateOne({ adminId }, { status });
      const label =
        status === UserStatus.BLOCKED
          ? locale.admin.blocked
          : locale.admin.unblocked;
      return `${locale.admin.userUpdated}: ${adminId} ${label}`;
    } catch {
      return locale.admin.userNotFound;
    }
  }

  private async getUserInfo(adminId: string, locale: Locale): Promise<string> {
    const user = await this.userService.findOne({ adminId });
    if (!user) return locale.admin.userNotFound;

    return [
      `<b>${locale.admin.userInfoTitle}:</b> ${user.adminId}`,
      `<b>${locale.admin.telegramId}:</b> ${user.telegramId}`,
      `<b>${locale.commands.role}:</b> ${getRoleLabel(user.role, locale)}`,
      `<b>${locale.commands.status}:</b> ${getStatusLabel(user.status, locale)}`,
      `<b>${locale.admin.gitlabId}:</b> ${user.gitLabId}`,
      `<b>${locale.admin.portalId}:</b> ${user.portalId}`,
      `<b>${locale.admin.gender}:</b> ${getGenderLabel(user.gender, locale)}`,
      `<b>${locale.commands.reportHour}:</b> ${user.settings?.reportHour ?? '—'}:00`,
      `<b>${locale.commands.ai}:</b> ${user.settings?.useAI ? locale.admin.yes : locale.admin.no}`,
      `<b>${locale.commands.template}:</b> ${getTemplateLabel(user.settings?.reportTemplate ?? 'Standard', locale)}`,
      `<b>${locale.commands.language}:</b> ${user.settings?.language ?? Language.RU}`,
    ].join('\n');
  }

  private async listUsers(locale: Locale): Promise<string> {
    const users = await this.userService.find();
    if (!users?.length) return locale.admin.noUsers;

    const lines = users.map(
      (user) =>
        `${user.adminId} — ${getRoleLabel(user.role, locale)} (${getStatusLabel(user.status, locale)})`,
    );
    return `${locale.admin.usersTitle} (${users.length}):\n${lines.join('\n')}`;
  }

  private buildHelp(locale: Locale): string {
    const commands = getOwnerBotCommands(locale);
    const lines = commands.map((c) => `/${c.command} — ${c.description}`);
    return `${locale.commands.availableCommands}:\n${lines.join('\n')}`;
  }
}
