import { Injectable, Logger } from '@nestjs/common';
import { BotSettingsRepository } from './bot-settings.repository';
import { BotSettingsMessages } from './constants/bot-settings.messages';
import { BOT_SETTINGS_KEY } from './constants/bot-settings.constants';
import type { BotSettings } from './bot-settings.schema';

@Injectable()
export class BotSettingsService {
  private readonly logger = new Logger(BotSettingsService.name);

  constructor(private readonly botSettingsRepository: BotSettingsRepository) {}

  //возвращает текущие настройки бота (создаёт документ, если его нет)
  async getSettings(): Promise<BotSettings> {
    const settings = await this.botSettingsRepository.findOne({
      key: BOT_SETTINGS_KEY,
    });

    if (settings) return settings;

    return this.botSettingsRepository.create({
      key: BOT_SETTINGS_KEY,
      isActive: true,
      reason: null,
      isForceBlocked: false,
      forceBlockReason: null,
    });
  }

  //проверяет, может ли бот работать (force block приоритетнее isActive)
  async canWork(): Promise<boolean> {
    const settings = await this.getSettings();

    if (settings.isForceBlocked) {
      this.logger.warn(
        `${BotSettingsMessages.BOT_FORCE_BLOCKED}: ${settings.forceBlockReason}`,
      );
      return false;
    }

    return settings.isActive;
  }

  //активирует бота (рабочий день)
  async activate(): Promise<void> {
    await this.botSettingsRepository.updateOne(
      { key: BOT_SETTINGS_KEY },
      { $set: { isActive: true, reason: null } },
      { upsert: true, new: true },
    );
    this.logger.log(BotSettingsMessages.BOT_ACTIVATED);
  }

  //деактивирует бота (выходной / праздник)
  async deactivate(reason: string): Promise<void> {
    await this.botSettingsRepository.updateOne(
      { key: BOT_SETTINGS_KEY },
      { $set: { isActive: false, reason } },
      { upsert: true, new: true },
    );
    this.logger.log(`${BotSettingsMessages.BOT_DEACTIVATED}: ${reason}`);
  }

  //принудительно блокирует бота (приоритет выше календаря)
  async forceBlock(reason: string): Promise<void> {
    await this.botSettingsRepository.updateOne(
      { key: BOT_SETTINGS_KEY },
      { $set: { isForceBlocked: true, forceBlockReason: reason } },
      { upsert: true, new: true },
    );
    this.logger.warn(`${BotSettingsMessages.BOT_FORCE_BLOCKED}: ${reason}`);
  }

  //снимает принудительную блокировку
  async forceUnblock(): Promise<void> {
    await this.botSettingsRepository.updateOne(
      { key: BOT_SETTINGS_KEY },
      { $set: { isForceBlocked: false, forceBlockReason: null } },
      { upsert: true, new: true },
    );
    this.logger.log(BotSettingsMessages.BOT_FORCE_UNBLOCKED);
  }
}
