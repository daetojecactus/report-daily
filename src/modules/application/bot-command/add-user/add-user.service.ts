import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { BotCommandSetupService } from '../bot-command-setup.service';
import { UserRole } from '../../user/user.enums';
import { VALID_ROLES } from '../constants/bot-command.constants';
import { AddUserStep, BotCallbackAction } from '../bot-command.enums';
import { getErrorMessage } from 'src/common/helpers/error.helper';
import { Language, getLocale } from 'src/common/i18n/i18n';
import type { Locale } from 'src/common/i18n/i18n.types';
import {
  buildColumnKeyboard,
  buildHourGridKeyboard,
} from '../keyboards/bot-command.keyboards';
import type { CommandResult } from '../bot-command.interface';

interface AddUserSession {
  step: AddUserStep;
  adminId?: string;
  telegramId?: number;
  role?: UserRole;
}

//визард добавления пользователя (пошаговый ввод + быстрая команда)
@Injectable()
export class AddUserService {
  private readonly logger = new Logger(AddUserService.name);
  private readonly sessions = new Map<number, AddUserSession>();

  constructor(
    private readonly userService: UserService,
    private readonly botCommandSetupService: BotCommandSetupService,
  ) {}

  hasSession(ownerTelegramId: number): boolean {
    return this.sessions.has(ownerTelegramId);
  }

  async startWizard(
    args: string[],
    ownerTelegramId?: number,
    language: Language = Language.RU,
  ): Promise<CommandResult> {
    const locale = getLocale(language);

    if (args.length >= 4) {
      return this.addUserDirect(args, locale);
    }

    if (ownerTelegramId) {
      this.sessions.set(ownerTelegramId, { step: AddUserStep.ADMIN_ID });
    }
    return { text: locale.admin.enterAdminId };
  }

  //обработка текстового ввода для шагов adminId и telegramId
  handleTextInput(
    ownerTelegramId: number,
    text: string,
    locale: Locale,
  ): CommandResult | null {
    const session = this.sessions.get(ownerTelegramId);
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
      return this.showRoleMenu(locale);
    }

    return null;
  }

  handleRoleSelection(
    role: string,
    ownerTelegramId?: number,
    locale?: Locale,
  ): CommandResult {
    const l = locale ?? getLocale(Language.RU);
    const entry = ownerTelegramId
      ? this.sessions.get(ownerTelegramId)
      : this.findSessionByStep(AddUserStep.ROLE);
    if (!entry || entry.step !== AddUserStep.ROLE) {
      return { text: l.admin.parseError };
    }
    entry.role = role as UserRole;
    entry.step = AddUserStep.HOUR;

    return {
      text: l.admin.selectHourWizard,
      keyboard: {
        inline_keyboard: buildHourGridKeyboard(
          (hour) => `${BotCallbackAction.ADD_USER_HOUR}:${hour}`,
        ),
      },
    };
  }

  async handleHourSelection(
    hourStr: string,
    ownerTelegramId?: number,
    locale?: Locale,
  ): Promise<CommandResult> {
    const l = locale ?? getLocale(Language.RU);
    const entry = ownerTelegramId
      ? this.sessions.get(ownerTelegramId)
      : this.findSessionByStep(AddUserStep.HOUR);
    if (!entry || entry.step !== AddUserStep.HOUR) {
      return { text: l.admin.parseError };
    }

    const reportHour = Number(hourStr);
    const { adminId, telegramId, role } = entry;

    for (const [key, val] of this.sessions.entries()) {
      if (val === entry) this.sessions.delete(key);
    }

    if (!adminId || !telegramId || !role) {
      return { text: l.admin.parseError };
    }

    return this.createUser({ adminId, telegramId, role, reportHour }, l);
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

    return this.createUser(
      { adminId, telegramId, role: role as UserRole, reportHour },
      locale,
    );
  }

  //общий путь создания пользователя + синхронизация меню команд
  private async createUser(
    input: {
      adminId: string;
      telegramId: number;
      role: UserRole;
      reportHour: number;
    },
    locale: Locale,
  ): Promise<CommandResult> {
    try {
      const user = await this.userService.createUser(input);
      await this.botCommandSetupService.syncAllCommandsSafe();
      return { text: `${locale.admin.userCreated}: ${user.adminId}` };
    } catch (error) {
      const msg = getErrorMessage(error);
      this.logger.error(`${locale.admin.createError}: ${msg}`);
      return { text: `${locale.admin.createError}: ${msg}` };
    }
  }

  private showRoleMenu(locale: Locale): CommandResult {
    return {
      text: locale.admin.selectRoleWizard,
      keyboard: {
        inline_keyboard: buildColumnKeyboard(VALID_ROLES, (role) => ({
          text: role,
          callback_data: `${BotCallbackAction.ADD_USER_ROLE}:${role}`,
        })),
      },
    };
  }

  private findSessionByStep(step: AddUserStep): AddUserSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.step === step) return session;
    }
    return undefined;
  }
}
