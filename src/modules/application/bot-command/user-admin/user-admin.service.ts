import { Injectable } from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { UserRole, UserStatus, ReportTemplate } from '../../user/user.enums';
import {
  VALID_ROLES,
  VALID_STATUSES,
} from '../constants/bot-command.constants';
import {
  BotCallbackAction,
  CallbackDataPrefix,
  UserField,
} from '../bot-command.enums';
import { getErrorMessage } from 'src/common/helpers/error.helper';
import { Language, getLocale } from 'src/common/i18n/i18n';
import type { Locale } from 'src/common/i18n/i18n.types';
import {
  getRoleLabel,
  getStatusLabel,
  getTemplateLabel,
  getGenderLabel,
} from 'src/common/i18n/entity-labels';
import {
  buildColumnKeyboard,
  buildHourGridKeyboard,
} from '../keyboards/bot-command.keyboards';
import type {
  CommandResult,
  InlineKeyboardMarkup,
} from '../bot-command.interface';

//административные операции над пользователями: просмотр, обновление, статусы
@Injectable()
export class UserAdminService {
  constructor(private readonly userService: UserService) {}

  async getUserInfo(adminId: string, locale: Locale): Promise<string> {
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

  async listUsers(locale: Locale): Promise<string> {
    const users = await this.userService.find();
    if (!users?.length) return locale.admin.noUsers;

    const lines = users.map(
      (user) =>
        `${user.adminId} — ${getRoleLabel(user.role, locale)} (${getStatusLabel(user.status, locale)})`,
    );
    return `${locale.admin.usersTitle} (${users.length}):\n${lines.join('\n')}`;
  }

  async setUserStatus(
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

  async showUserSelectMenu(
    action: BotCallbackAction,
    title: string,
    locale: Locale,
  ): Promise<CommandResult> {
    const users = await this.userService.find();
    if (!users?.length) return { text: title };

    return {
      text: title,
      keyboard: {
        inline_keyboard: buildColumnKeyboard(users, (user) => ({
          text: `${user.adminId} (${getRoleLabel(user.role, locale)})`,
          callback_data: `${action}:${user.adminId}`,
        })),
      },
    };
  }

  async showUpdateUserMenu(
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

  showUpdateFieldMenu(adminId: string, locale: Locale): CommandResult {
    const field = (name: UserField): string =>
      `${CallbackDataPrefix.UPDATE_FIELD}:${adminId}:${name}`;

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: locale.commands.role, callback_data: field(UserField.ROLE) },
          {
            text: locale.commands.status,
            callback_data: field(UserField.STATUS),
          },
        ],
        [
          {
            text: locale.commands.reportHour,
            callback_data: field(UserField.REPORT_HOUR),
          },
          { text: locale.commands.ai, callback_data: field(UserField.USE_AI) },
        ],
        [
          {
            text: locale.commands.template,
            callback_data: field(UserField.REPORT_TEMPLATE),
          },
          {
            text: locale.commands.language,
            callback_data: field(UserField.LANGUAGE),
          },
        ],
      ],
    };
    return {
      text: `${locale.admin.selectField} (${adminId}):`,
      keyboard,
    };
  }

  //показ меню выбора значения для поля пользователя
  handleFieldCallback(data: string, language: Language): CommandResult {
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

  //применение выбранного значения к пользователю
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

  private value(adminId: string, field: UserField, value: string): string {
    return `${CallbackDataPrefix.UPDATE_VALUE}:${adminId}:${field}:${value}`;
  }

  private showRoleSelectMenu(adminId: string, locale: Locale): CommandResult {
    return {
      text: `${locale.admin.selectRole} (${adminId}):`,
      keyboard: {
        inline_keyboard: buildColumnKeyboard(VALID_ROLES, (role) => ({
          text: getRoleLabel(role, locale),
          callback_data: this.value(adminId, UserField.ROLE, role),
        })),
      },
    };
  }

  private showStatusSelectMenu(adminId: string, locale: Locale): CommandResult {
    return {
      text: `${locale.admin.selectStatus} (${adminId}):`,
      keyboard: {
        inline_keyboard: buildColumnKeyboard(VALID_STATUSES, (status) => ({
          text: getStatusLabel(status, locale),
          callback_data: this.value(adminId, UserField.STATUS, status),
        })),
      },
    };
  }

  private showHourSelectMenu(adminId: string, locale: Locale): CommandResult {
    return {
      text: `${locale.admin.selectHour} (${adminId}):`,
      keyboard: {
        inline_keyboard: buildHourGridKeyboard((hour) =>
          this.value(adminId, UserField.REPORT_HOUR, String(hour)),
        ),
      },
    };
  }

  private showAISelectMenu(adminId: string, locale: Locale): CommandResult {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: locale.commands.enable,
            callback_data: this.value(adminId, UserField.USE_AI, 'true'),
          },
          {
            text: locale.commands.disable,
            callback_data: this.value(adminId, UserField.USE_AI, 'false'),
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
    return {
      text: `${locale.admin.selectTemplate} (${adminId}):`,
      keyboard: {
        inline_keyboard: buildColumnKeyboard(
          Object.values(ReportTemplate),
          (template) => ({
            text: getTemplateLabel(template, locale),
            callback_data: this.value(
              adminId,
              UserField.REPORT_TEMPLATE,
              template,
            ),
          }),
        ),
      },
    };
  }

  private showLanguageSelectMenu(
    adminId: string,
    locale: Locale,
  ): CommandResult {
    return {
      text: `${locale.admin.selectLanguage} (${adminId}):`,
      keyboard: {
        inline_keyboard: buildColumnKeyboard(
          Object.values(Language),
          (lang) => ({
            text:
              lang === Language.RU
                ? locale.commands.russian
                : locale.commands.english,
            callback_data: this.value(adminId, UserField.LANGUAGE, lang),
          }),
        ),
      },
    };
  }
}
