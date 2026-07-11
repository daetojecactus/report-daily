import { Controller, Post, Query } from '@nestjs/common';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { getOwnerBotCommands } from 'src/modules/application/bot-command/constants/bot-command.constants';
import { BotCommandSetupService } from 'src/modules/application/bot-command/bot-command-setup.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from 'src/modules/application/user/user.service';
import { SchedulerService } from 'src/modules/application/scheduler/scheduler.service';
import type { ReportDailyBotEnvs } from 'src/modules/infrastructure/config/env';
import { Language, getLocale } from 'src/common/i18n/i18n';

@Controller('report')
export class ReportController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly userService: UserService,
    private readonly botCommandSetupService: BotCommandSetupService,
    private readonly schedulerService: SchedulerService,
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {}

  //тестовая рассылка: всем активным пользователям отчёты за последние N дней
  @Post('send-recent')
  async sendRecentReports(@Query('days') daysRaw?: string) {
    const days = daysRaw !== undefined ? Number(daysRaw) : undefined;
    const summary =
      await this.schedulerService.sendRecentReportsToAllUsers(days);
    return { ok: true, ...summary };
  }

  //проставляет корректное меню команд всем пользователям и овнеру разом
  @Post('setup-commands')
  async setupCommands() {
    const results = await this.botCommandSetupService.syncAllCommands();
    return { ok: true, results };
  }

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
    const results = await this.botCommandSetupService.syncAllCommands();
    return { ok: true, results };
  }
}
