import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BotSettingsRepository } from './bot-settings.repository';
import { BotSettingsMessages } from './constants/bot-settings.messages';
import { BOT_SETTINGS_KEY } from './constants/bot-settings.constants';
import type { BotSettings } from './bot-settings.schema';

@Injectable()
export class BotSettingsService {
  private readonly logger = new Logger(BotSettingsService.name);

  constructor(private readonly botSettingsRepository: BotSettingsRepository) {}

  async findOne(filter: Partial<BotSettings>) {
    const settings = await this.botSettingsRepository.findOne(filter);
    if (!settings) {
      throw new NotFoundException(BotSettingsMessages.BOT_SETTINGS_NOT_FOUND);
    }
    return settings;
  }

  async create(settings: BotSettings) {
    return this.botSettingsRepository.create(settings);
  }

  async updateOne(
    filter: Partial<BotSettings>,
    partialSettings: Partial<BotSettings>,
  ) {
    const settings = await this.botSettingsRepository.updateOne(
      filter,
      { $set: partialSettings },
      { new: true },
    );
    if (!settings) {
      throw new NotFoundException(BotSettingsMessages.BOT_SETTINGS_NOT_FOUND);
    }

    return settings;
  }

  //проверяет, может ли бот работать
  async canWork(): Promise<boolean> {
    const settings = await this.findOne({ key: BOT_SETTINGS_KEY });

    if (settings.isForceBlocked) {
      return false;
    }

    return settings.isActive;
  }

  //активирует бота
  async activate(): Promise<void> {
    await this.botSettingsRepository.updateOne(
      { key: BOT_SETTINGS_KEY },
      { $set: { isActive: true, reason: null } },
      { upsert: true, new: true },
    );
    this.logger.log(BotSettingsMessages.BOT_ACTIVATED);
  }

  //деактивирует бота выходной/праздник
  async deactivate(reason: string): Promise<void> {
    await this.botSettingsRepository.updateOne(
      { key: BOT_SETTINGS_KEY },
      { $set: { isActive: false, reason } },
      { upsert: true, new: true },
    );
    this.logger.log(`${BotSettingsMessages.BOT_DEACTIVATED}: ${reason}`);
  }

  //принудительно блокирует бота
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
