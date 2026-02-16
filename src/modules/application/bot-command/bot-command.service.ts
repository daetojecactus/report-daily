import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UserRole, UserStatus } from '../user/user.interface';
import { BotCommandMessages } from './constants/bot-command.messages';
import {
  OWNER_BOT_COMMANDS,
  REPORT_HOURS,
  VALID_ROLES,
  VALID_STATUSES,
} from './constants/bot-command.constants';
import {
  BotCallbackAction,
  BotCommand,
  CommandResult,
  InlineKeyboardMarkup,
  UserField,
} from './bot-command.types';
import { getErrorMessage } from 'src/common/helpers/error.helper';

@Injectable()
export class BotCommandService {
  private readonly logger = new Logger(BotCommandService.name);

  constructor(private readonly userService: UserService) {}

  async handleStartCommand(telegramId: number): Promise<string | null> {
    const user = await this.userService.findOne({ telegramId });
    return user ? BotCommandMessages.START_WELCOME : null;
  }

  async handleCommand(text: string): Promise<CommandResult> {
    const [command, ...args] = text.trim().split(/\s+/);

    switch (command?.toLowerCase()) {
      case BotCommand.ADD_USER:
        return this.addUser(args);
      case BotCommand.UPDATE_USER:
        return this.showUpdateUserMenu(args);
      case BotCommand.BLOCK_USER:
        return this.showUserSelectMenu(
          BotCallbackAction.BLOCK_USER,
          BotCommandMessages.SELECT_USER_BLOCK,
        );
      case BotCommand.UNBLOCK_USER:
        return this.showUserSelectMenu(
          BotCallbackAction.UNBLOCK_USER,
          BotCommandMessages.SELECT_USER_UNBLOCK,
        );
      case BotCommand.USER_INFO:
        return this.showUserSelectMenu(
          BotCallbackAction.USER_INFO,
          BotCommandMessages.SELECT_USER_INFO,
        );
      case BotCommand.TEST_REPORT:
        return this.showUserSelectMenu(
          BotCallbackAction.TEST_REPORT,
          BotCommandMessages.SELECT_USER_REPORT,
        );
      case BotCommand.LIST_USERS:
        return { text: await this.listUsers() };
      case BotCommand.HELP:
        return { text: this.buildHelp() };
      default:
        return { text: BotCommandMessages.COMMAND_UNKNOWN };
    }
  }

  async handleCallback(data: string): Promise<CommandResult> {
    const parsed = this.parseCallback(data);
    if (!parsed) return { text: BotCommandMessages.UNKNOWN_ACTION };

    switch (parsed.action) {
      case BotCallbackAction.USER_INFO:
        return { text: await this.getUserInfo(parsed.adminId) };
      case BotCallbackAction.BLOCK_USER:
        return {
          text: await this.setUserStatus(parsed.adminId, UserStatus.BLOCKED),
        };
      case BotCallbackAction.UNBLOCK_USER:
        return {
          text: await this.setUserStatus(parsed.adminId, UserStatus.ACTIVE),
        };
      case BotCallbackAction.TEST_REPORT:
        return { text: `__TEST_REPORT__:${parsed.adminId}` };
      case BotCallbackAction.UPDATE_USER:
        return this.showUpdateFieldMenu(parsed.adminId);
      default:
        return { text: BotCommandMessages.UNKNOWN_ACTION };
    }
  }

  async handleFieldCallback(data: string): Promise<CommandResult> {
    const parts = data.split(':');
    if (parts.length < 3) return { text: BotCommandMessages.PARSE_ERROR };

    const [, adminId, field] = parts;

    switch (field) {
      case UserField.ROLE:
        return this.showRoleSelectMenu(adminId!);
      case UserField.STATUS:
        return this.showStatusSelectMenu(adminId!);
      case UserField.REPORT_HOUR:
        return this.showHourSelectMenu(adminId!);
      case UserField.USE_AI:
        return this.showAISelectMenu(adminId!);
      default:
        return { text: BotCommandMessages.UNKNOWN_FIELD };
    }
  }

  async handleValueCallback(data: string): Promise<CommandResult> {
    const parts = data.split(':');
    if (parts.length < 4) return { text: BotCommandMessages.PARSE_ERROR };

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
      }
      return {
        text: `${BotCommandMessages.COMMAND_USER_UPDATED}: ${adminId} (${field} = ${value})`,
      };
    } catch (error) {
      return {
        text: `${BotCommandMessages.COMMAND_UPDATE_ERROR}: ${getErrorMessage(error)}`,
      };
    }
  }

  private async showUserSelectMenu(
    action: BotCallbackAction,
    title: string,
  ): Promise<CommandResult> {
    const users = await this.userService.find();
    if (!users?.length) return { text: BotCommandMessages.COMMAND_NO_USERS };

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: users.map((user) => [
        {
          text: `${user.adminId} (${user.role})`,
          callback_data: `${action}:${user.adminId}`,
        },
      ]),
    };

    return { text: title, keyboard };
  }

  private async showUpdateUserMenu(args: string[]): Promise<CommandResult> {
    if (args.length >= 1) {
      const adminId = args[0]!;
      const user = await this.userService.findOne({ adminId });
      if (!user) return { text: BotCommandMessages.COMMAND_USER_NOT_FOUND };
      return this.showUpdateFieldMenu(adminId);
    }
    return this.showUserSelectMenu(
      BotCallbackAction.UPDATE_USER,
      BotCommandMessages.SELECT_USER_UPDATE,
    );
  }

  private showUpdateFieldMenu(adminId: string): CommandResult {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: BotCommandMessages.LABEL_ROLE,
            callback_data: `uf:${adminId}:${UserField.ROLE}`,
          },
          {
            text: BotCommandMessages.LABEL_STATUS,
            callback_data: `uf:${adminId}:${UserField.STATUS}`,
          },
        ],
        [
          {
            text: BotCommandMessages.LABEL_REPORT_HOUR,
            callback_data: `uf:${adminId}:${UserField.REPORT_HOUR}`,
          },
          {
            text: BotCommandMessages.LABEL_AI,
            callback_data: `uf:${adminId}:${UserField.USE_AI}`,
          },
        ],
      ],
    };
    return {
      text: `${BotCommandMessages.SELECT_FIELD} (${adminId}):`,
      keyboard,
    };
  }

  private showRoleSelectMenu(adminId: string): CommandResult {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: VALID_ROLES.map((role) => [
        {
          text: role,
          callback_data: `uv:${adminId}:${UserField.ROLE}:${role}`,
        },
      ]),
    };
    return {
      text: `${BotCommandMessages.SELECT_ROLE} (${adminId}):`,
      keyboard,
    };
  }

  private showStatusSelectMenu(adminId: string): CommandResult {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: VALID_STATUSES.map((status) => [
        {
          text: status,
          callback_data: `uv:${adminId}:${UserField.STATUS}:${status}`,
        },
      ]),
    };
    return {
      text: `${BotCommandMessages.SELECT_STATUS} (${adminId}):`,
      keyboard,
    };
  }

  private showHourSelectMenu(adminId: string): CommandResult {
    const rows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < REPORT_HOURS.length; i += 4) {
      rows.push(
        REPORT_HOURS.slice(i, i + 4).map((hour) => ({
          text: `${hour}:00`,
          callback_data: `uv:${adminId}:${UserField.REPORT_HOUR}:${hour}`,
        })),
      );
    }
    return {
      text: `${BotCommandMessages.SELECT_HOUR} (${adminId}):`,
      keyboard: { inline_keyboard: rows },
    };
  }

  private showAISelectMenu(adminId: string): CommandResult {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: BotCommandMessages.LABEL_ENABLE,
            callback_data: `uv:${adminId}:${UserField.USE_AI}:true`,
          },
          {
            text: BotCommandMessages.LABEL_DISABLE,
            callback_data: `uv:${adminId}:${UserField.USE_AI}:false`,
          },
        ],
      ],
    };
    return { text: `${BotCommandMessages.SELECT_AI} (${adminId}):`, keyboard };
  }

  private parseCallback(
    data: string,
  ): { action: BotCallbackAction; adminId: string } | null {
    const parts = data.split(':');
    if (parts.length < 2) return null;

    const [action, adminId] = parts;
    if (!Object.values(BotCallbackAction).includes(action as BotCallbackAction))
      return null;

    return { action: action as BotCallbackAction, adminId: adminId! };
  }

  private async addUser(args: string[]): Promise<CommandResult> {
    if (args.length < 4) {
      return {
        text: `${BotCommandMessages.COMMAND_INVALID_ARGS}: /add_user adminId telegramId role reportHour`,
      };
    }

    const [adminId, tgIdStr, role, hourStr] = args;
    const telegramId = Number(tgIdStr);
    const reportHour = Number(hourStr);

    if (isNaN(telegramId) || isNaN(reportHour)) {
      return {
        text: `${BotCommandMessages.COMMAND_INVALID_ARGS}: telegramId и reportHour — числа`,
      };
    }

    if (!VALID_ROLES.includes(role!)) {
      return {
        text: `${BotCommandMessages.COMMAND_INVALID_ARGS}: роли — ${VALID_ROLES.join(', ')}`,
      };
    }

    try {
      const user = await this.userService.createUser({
        adminId: adminId!,
        telegramId,
        role: role as UserRole,
        reportHour,
      });
      return {
        text: `${BotCommandMessages.COMMAND_USER_CREATED}: ${user.adminId}`,
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      this.logger.error(`${BotCommandMessages.COMMAND_CREATE_ERROR}: ${msg}`);
      return { text: `${BotCommandMessages.COMMAND_CREATE_ERROR}: ${msg}` };
    }
  }

  private async setUserStatus(
    adminId: string,
    status: UserStatus,
  ): Promise<string> {
    try {
      await this.userService.updateOne({ adminId }, { status });
      const label =
        status === UserStatus.BLOCKED
          ? BotCommandMessages.USER_BLOCKED
          : BotCommandMessages.USER_UNBLOCKED;
      return `${BotCommandMessages.COMMAND_USER_UPDATED}: ${adminId} ${label}`;
    } catch {
      return BotCommandMessages.COMMAND_USER_NOT_FOUND;
    }
  }

  private async getUserInfo(adminId: string): Promise<string> {
    const user = await this.userService.findOne({ adminId });
    if (!user) return BotCommandMessages.COMMAND_USER_NOT_FOUND;

    return [
      `<b>Пользователь:</b> ${user.adminId}`,
      `<b>Роль:</b> ${user.role}`,
      `<b>Статус:</b> ${user.status}`,
      `<b>GitLab ID:</b> ${user.gitLabId}`,
      `<b>Portal ID:</b> ${user.portalId}`,
      `<b>Час отчёта:</b> ${user.settings?.reportHour ?? '—'}`,
      `<b>AI:</b> ${user.settings?.useAI ? 'Да' : 'Нет'}`,
    ].join('\n');
  }

  private async listUsers(): Promise<string> {
    const users = await this.userService.find();
    if (!users?.length) return BotCommandMessages.COMMAND_NO_USERS;

    const lines = users.map(
      (user) => `${user.adminId} — ${user.role} (${user.status})`,
    );
    return `Пользователи (${users.length}):\n${lines.join('\n')}`;
  }

  private buildHelp(): string {
    const lines = OWNER_BOT_COMMANDS.map(
      (c) => `/${c.command} — ${c.description}`,
    );
    return `Доступные команды:\n${lines.join('\n')}`;
  }
}
