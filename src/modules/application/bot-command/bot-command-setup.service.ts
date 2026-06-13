import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import type { ReportDailyBotEnvs } from 'src/modules/config/env';
import { Language, getLocale } from 'src/common/i18n/i18n';
import { getErrorMessage } from 'src/common/helpers/error.helper';
import { UserService } from '../user/user.service';
import {
  getOwnerBotCommands,
  getUserBotCommands,
} from './constants/bot-command.constants';

//результат синхронизации команд по одному чату
export interface CommandSyncResult {
  telegramId: number;
  ok: boolean;
}

@Injectable()
export class BotCommandSetupService {
  private readonly logger = new Logger(BotCommandSetupService.name);
  private readonly ownerTelegramId: number;

  constructor(
    private readonly telegramService: TelegramService,
    private readonly userService: UserService,
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {
    this.ownerTelegramId = this.configService.get('OWNER_TELEGRAM_ID');
  }

  //проставляет корректное меню команд всем: овнеру — команды овнера,
  //остальным пользователям — пользовательские. порядок не важен, так как
  //овнер всегда получает свой набор, даже если он есть в списке пользователей
  async syncAllCommands(): Promise<CommandSyncResult[]> {
    const users = await this.userService.find({
      telegramId: { $exists: true },
    });

    const targets = new Map<number, Language>();

    //сначала пользователи
    for (const user of users) {
      if (!user.telegramId) continue;
      targets.set(user.telegramId, user.settings?.language ?? Language.RU);
    }

    //овнер обязательно присутствует и перетирает пользовательский набор
    if (!targets.has(this.ownerTelegramId)) {
      const owner = await this.userService.findOne({
        telegramId: this.ownerTelegramId,
      });
      targets.set(
        this.ownerTelegramId,
        owner?.settings?.language ?? Language.RU,
      );
    }

    const results: CommandSyncResult[] = [];
    for (const [telegramId, language] of targets) {
      results.push(await this.applyCommands(telegramId, language));
    }

    return results;
  }

  //проставляет команды одному пользователю с учётом того, овнер он или нет
  async syncCommandsForTelegramId(
    telegramId: number,
    language?: Language,
  ): Promise<CommandSyncResult> {
    const resolvedLanguage =
      language ?? (await this.resolveLanguage(telegramId));
    return this.applyCommands(telegramId, resolvedLanguage);
  }

  //безопасно (с логированием) синхронизирует команды всем — для авто-вызова
  async syncAllCommandsSafe(): Promise<void> {
    try {
      await this.syncAllCommands();
    } catch (error) {
      this.logger.error(
        `Failed to sync bot commands: ${getErrorMessage(error)}`,
      );
    }
  }

  private async applyCommands(
    telegramId: number,
    language: Language,
  ): Promise<CommandSyncResult> {
    const locale = getLocale(language);
    const commands =
      telegramId === this.ownerTelegramId
        ? getOwnerBotCommands(locale)
        : getUserBotCommands(locale);

    try {
      await this.telegramService.setCommandsForChat(telegramId, commands);
      return { telegramId, ok: true };
    } catch (error) {
      this.logger.warn(
        `Failed to set commands for ${telegramId}: ${getErrorMessage(error)}`,
      );
      return { telegramId, ok: false };
    }
  }

  private async resolveLanguage(telegramId: number): Promise<Language> {
    const user = await this.userService.findOne({ telegramId });
    return user?.settings?.language ?? Language.RU;
  }
}
