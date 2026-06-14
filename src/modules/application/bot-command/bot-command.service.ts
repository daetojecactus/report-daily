import { Injectable } from '@nestjs/common';
import { AddUserService } from './add-user/add-user.service';
import { BroadcastService } from './broadcast/broadcast.service';
import { UserAdminService } from './user-admin/user-admin.service';
import { UserStatus } from '../user/user.enums';
import {
  getOwnerBotCommands,
  TEST_REPORT_MARKER,
} from './constants/bot-command.constants';
import { BotCallbackAction, BotCommand } from './bot-command.enums';
import { Language, getLocale } from 'src/common/i18n/i18n';
import type { Locale } from 'src/common/i18n/i18n.types';
import type { CommandResult } from './bot-command.interface';

//фасад-роутер команд овнера: разбирает ввод и делегирует в под-сервисы
@Injectable()
export class BotCommandService {
  constructor(
    private readonly addUserService: AddUserService,
    private readonly broadcastService: BroadcastService,
    private readonly userAdminService: UserAdminService,
  ) {}

  hasActiveInputSession(ownerTelegramId: number): boolean {
    return (
      this.addUserService.hasSession(ownerTelegramId) ||
      this.broadcastService.hasSession(ownerTelegramId)
    );
  }

  handleTextInput(
    ownerTelegramId: number,
    text: string,
    language: Language,
  ): CommandResult | null {
    const locale = getLocale(language);

    const broadcastResult = this.broadcastService.handleTextInput(
      ownerTelegramId,
      text,
      locale,
    );
    if (broadcastResult) return broadcastResult;

    return this.addUserService.handleTextInput(ownerTelegramId, text, locale);
  }

  async handleCommand(
    text: string,
    language: Language,
  ): Promise<CommandResult> {
    const [command, ...args] = text.trim().split(/\s+/);
    const locale = getLocale(language);

    switch (command?.toLowerCase()) {
      case BotCommand.ADD_USER:
        return this.addUserService.startWizard(args, undefined, language);
      case BotCommand.UPDATE_USER:
        return this.userAdminService.showUpdateUserMenu(args, locale);
      case BotCommand.BLOCK_USER:
        return this.userAdminService.showUserSelectMenu(
          BotCallbackAction.BLOCK_USER,
          locale.admin.selectUserBlock,
          locale,
        );
      case BotCommand.UNBLOCK_USER:
        return this.userAdminService.showUserSelectMenu(
          BotCallbackAction.UNBLOCK_USER,
          locale.admin.selectUserUnblock,
          locale,
        );
      case BotCommand.USER_INFO:
        return this.userAdminService.showUserSelectMenu(
          BotCallbackAction.USER_INFO,
          locale.admin.selectUserInfo,
          locale,
        );
      case BotCommand.SEND_USER_REPORT:
        return this.userAdminService.showUserSelectMenu(
          BotCallbackAction.TEST_REPORT,
          locale.admin.selectUserReport,
          locale,
        );
      case BotCommand.LIST_USERS:
        return { text: await this.userAdminService.listUsers(locale) };
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
        return {
          text: await this.userAdminService.getUserInfo(parsed.adminId, locale),
        };
      case BotCallbackAction.BLOCK_USER:
        return {
          text: await this.userAdminService.setUserStatus(
            parsed.adminId,
            UserStatus.BLOCKED,
            locale,
          ),
        };
      case BotCallbackAction.UNBLOCK_USER:
        return {
          text: await this.userAdminService.setUserStatus(
            parsed.adminId,
            UserStatus.ACTIVE,
            locale,
          ),
        };
      case BotCallbackAction.TEST_REPORT:
        return { text: `${TEST_REPORT_MARKER}${parsed.adminId}` };
      case BotCallbackAction.UPDATE_USER:
        return this.userAdminService.showUpdateFieldMenu(
          parsed.adminId,
          locale,
        );
      case BotCallbackAction.ADD_USER_ROLE:
        return this.addUserService.handleRoleSelection(
          parsed.adminId,
          undefined,
          locale,
        );
      case BotCallbackAction.ADD_USER_HOUR:
        return this.addUserService.handleHourSelection(
          parsed.adminId,
          undefined,
          locale,
        );
      default:
        return { text: locale.admin.unknownAction };
    }
  }

  handleFieldCallback(data: string, language: Language): CommandResult {
    return this.userAdminService.handleFieldCallback(data, language);
  }

  handleValueCallback(
    data: string,
    language: Language,
  ): Promise<CommandResult> {
    return this.userAdminService.handleValueCallback(data, language);
  }

  startAddUserWizard(
    args: string[],
    ownerTelegramId?: number,
    language: Language = Language.RU,
  ): Promise<CommandResult> {
    return this.addUserService.startWizard(args, ownerTelegramId, language);
  }

  startBroadcastWizard(
    ownerTelegramId: number,
    language: Language = Language.RU,
  ): CommandResult {
    return this.broadcastService.startWizard(ownerTelegramId, language);
  }

  handleBroadcastCallback(
    ownerTelegramId: number,
    data: string,
    language: Language,
  ): Promise<CommandResult> {
    return this.broadcastService.handleCallback(
      ownerTelegramId,
      data,
      language,
    );
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

  private buildHelp(locale: Locale): string {
    const commands = getOwnerBotCommands(locale);
    const lines = commands.map(
      (command) => `/${command.command} — ${command.description}`,
    );
    return `${locale.commands.availableCommands}:\n${lines.join('\n')}`;
  }
}
