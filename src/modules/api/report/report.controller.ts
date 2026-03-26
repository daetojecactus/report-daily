import { Controller, Post } from '@nestjs/common';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import {
  getOwnerBotCommands,
  getUserBotCommands,
} from 'src/modules/application/bot-command/constants/bot-command.constants';
import { ConfigService } from '@nestjs/config';
import { UserService } from 'src/modules/application/user/user.service';
import type { ReportDailyBotEnvs } from 'src/modules/config/env';
import { Language, getLocale } from 'src/common/i18n/i18n';

@Controller('report')
export class ReportController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly userService: UserService,
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {}

  @Post('setup-owner-commands')
  async setupOwnerCommands() {
    const ownerTelegramId = this.configService.get('OWNER_TELEGRAM_ID');
    const owner = await this.userService.findOne({
      telegramId: ownerTelegramId,
    });
    const lang = owner?.settings?.language ?? Language.RU;
    const locale = getLocale(lang);
    const commands = getOwnerBotCommands(locale);
    await this.telegramService.setCommandsForChat(ownerTelegramId, commands);
    return { ok: true, ownerTelegramId, commands };
  }

  @Post('setup-user-commands')
  async setupUserCommands() {
    const users = await this.userService.find({
      telegramId: { $exists: true },
    });
    const results: { telegramId: number; ok: boolean }[] = [];

    for (const user of users) {
      if (!user.telegramId) continue;
      const lang = user.settings?.language ?? Language.RU;
      const locale = getLocale(lang);
      const commands = getUserBotCommands(locale);
      try {
        await this.telegramService.setCommandsForChat(
          user.telegramId,
          commands,
        );
        results.push({ telegramId: user.telegramId, ok: true });
      } catch {
        results.push({ telegramId: user.telegramId, ok: false });
      }
    }

    return { ok: true, results };
  }
}
