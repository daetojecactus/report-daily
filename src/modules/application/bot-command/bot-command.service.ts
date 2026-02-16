import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UserRole, UserStatus } from '../user/user.interface';
import { BotCommandMessages } from './constants/bot-command.messages';
import { OWNER_BOT_COMMANDS } from './constants/bot-command.constants';

const VALID_ROLES: string[] = Object.values(UserRole);
const VALID_STATUSES: string[] = Object.values(UserStatus);

@Injectable()
export class BotCommandService {
  private readonly logger = new Logger(BotCommandService.name);

  constructor(private readonly userService: UserService) {}

  //обработка команды от owner
  async handleCommand(text: string): Promise<string> {
    const [command, ...args] = text.trim().split(/\s+/);

    switch (command?.toLowerCase()) {
      case '/add_user':
        return this.addUser(args);
      case '/update_user':
        return this.updateUser(args);
      case '/block_user':
        return this.setStatus(args, UserStatus.BLOCKED);
      case '/unblock_user':
        return this.setStatus(args, UserStatus.ACTIVE);
      case '/user_info':
        return this.userInfo(args);
      case '/list_users':
        return this.listUsers();
      case '/help':
        return this.buildHelp();
      default:
        return BotCommandMessages.COMMAND_UNKNOWN;
    }
  }

  // /add_user <adminId> <telegramId> <role> <reportHour>
  private async addUser(args: string[]): Promise<string> {
    if (args.length < 4) {
      return `${BotCommandMessages.COMMAND_INVALID_ARGS}: /add_user adminId telegramId role reportHour`;
    }

    const [adminId, tgIdStr, role, hourStr] = args;
    const telegramId = Number(tgIdStr);
    const reportHour = Number(hourStr);

    if (isNaN(telegramId) || isNaN(reportHour)) {
      return `${BotCommandMessages.COMMAND_INVALID_ARGS}: telegramId и reportHour — числа`;
    }
    if (!VALID_ROLES.includes(role!)) {
      return `${BotCommandMessages.COMMAND_INVALID_ARGS}: роли — ${VALID_ROLES.join(', ')}`;
    }

    try {
      const user = await this.userService.createUser({
        adminId: adminId!,
        telegramId,
        role: role as UserRole,
        reportHour,
      });
      return `${BotCommandMessages.COMMAND_USER_CREATED}: ${user.adminId}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`${BotCommandMessages.COMMAND_CREATE_ERROR}: ${msg}`);
      return `${BotCommandMessages.COMMAND_CREATE_ERROR}: ${msg}`;
    }
  }

  // /update_user <adminId> <field> <value>
  private async updateUser(args: string[]): Promise<string> {
    if (args.length < 3) {
      return `${BotCommandMessages.COMMAND_INVALID_ARGS}: /update_user adminId field value`;
    }

    const [adminId, field, ...rest] = args;
    const value = rest.join(' ');
    const user = await this.userService.findOne({ adminId });

    if (!user) return BotCommandMessages.COMMAND_USER_NOT_FOUND;

    try {
      switch (field) {
        case 'role':
          if (!VALID_ROLES.includes(value)) {
            return `${BotCommandMessages.COMMAND_INVALID_ARGS}: роли — ${VALID_ROLES.join(', ')}`;
          }
          await this.userService.updateOne(
            { adminId },
            { role: value as UserRole },
          );
          break;

        case 'status':
          if (!VALID_STATUSES.includes(value)) {
            return `${BotCommandMessages.COMMAND_INVALID_ARGS}: статусы — ${VALID_STATUSES.join(', ')}`;
          }
          await this.userService.updateOne(
            { adminId },
            { status: value as UserStatus },
          );
          break;

        case 'reportHour': {
          const hour = Number(value);
          if (isNaN(hour) || hour < 0 || hour > 23) {
            return `${BotCommandMessages.COMMAND_INVALID_ARGS}: reportHour 0–23`;
          }
          await this.userService.updateUserSettings(
            { adminId },
            { reportHour: hour },
          );
          break;
        }

        case 'useAI':
          await this.userService.updateUserSettings(
            { adminId },
            { useAI: value === 'true' },
          );
          break;

        default:
          return `${BotCommandMessages.COMMAND_INVALID_ARGS}: поля — role, status, reportHour, useAI`;
      }
      return `${BotCommandMessages.COMMAND_USER_UPDATED}: ${adminId} (${field} = ${value})`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`${BotCommandMessages.COMMAND_UPDATE_ERROR}: ${msg}`);
      return `${BotCommandMessages.COMMAND_UPDATE_ERROR}: ${msg}`;
    }
  }

  // /block_user | /unblock_user <adminId>
  private async setStatus(args: string[], status: UserStatus): Promise<string> {
    if (args.length < 1)
      return `${BotCommandMessages.COMMAND_INVALID_ARGS}: укажите adminId`;

    try {
      await this.userService.updateOne({ adminId: args[0] }, { status });
      const label =
        status === UserStatus.BLOCKED ? 'заблокирован' : 'разблокирован';
      return `${BotCommandMessages.COMMAND_USER_UPDATED}: ${args[0]} ${label}`;
    } catch {
      return BotCommandMessages.COMMAND_USER_NOT_FOUND;
    }
  }

  // /user_info <adminId>
  private async userInfo(args: string[]): Promise<string> {
    if (args.length < 1)
      return `${BotCommandMessages.COMMAND_INVALID_ARGS}: укажите adminId`;

    const user = await this.userService.findOne({ adminId: args[0] });
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

  // /list_users
  private async listUsers(): Promise<string> {
    const users = await this.userService.find();
    if (!users || users.length === 0)
      return BotCommandMessages.COMMAND_NO_USERS;

    const lines = users.map(
      (u) => `• <b>${u.adminId}</b> — ${u.role} (${u.status})`,
    );
    return `Пользователи (${users.length}):\n${lines.join('\n')}`;
  }

  // /help — список команд из константы
  private buildHelp(): string {
    const lines = OWNER_BOT_COMMANDS.map(
      (c) => `/${c.command} — ${c.description}`,
    );
    return `Доступные команды:\n${lines.join('\n')}`;
  }
}
