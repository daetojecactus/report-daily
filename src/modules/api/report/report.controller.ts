import { Controller, Post } from '@nestjs/common';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { OWNER_BOT_COMMANDS } from 'src/modules/application/bot-command/constants/bot-command.constants';
import { ConfigService } from '@nestjs/config';
import type { ReportDailyBotEnvs } from 'src/config/env';

@Controller('report')
export class ReportController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {}

  //устанавливает команды бота для owner
  @Post('setup-owner-commands')
  async setupOwnerCommands() {
    const ownerTelegramId = this.configService.get('OWNER_TELEGRAM_ID');
    await this.telegramService.setCommandsForChat(
      ownerTelegramId,
      OWNER_BOT_COMMANDS,
    );
    return { ok: true, ownerTelegramId, commands: OWNER_BOT_COMMANDS };
  }
}
