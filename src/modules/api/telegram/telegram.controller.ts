import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { BotCommandService } from 'src/modules/application/bot-command/bot-command.service';
import type { TelegramUpdate } from 'src/modules/vendors/telegram/telegram.types';
import type { ReportDailyBotEnvs } from 'src/config/env';

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly botCommandService: BotCommandService,
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {}

  //обработка входящих обновлений от telegram
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token') token: string,
    @Body() body: TelegramUpdate,
  ): Promise<void> {
    //проверка секретного токена
    if (token !== this.configService.get('TELEGRAM_BOT_SECRET_TOKEN')) return;

    //извлекаем telegramId и текст сообщения
    const telegramId =
      body.message?.from?.id ??
      body.callback_query?.from?.id ??
      body.edited_message?.from?.id;

    const text = body.message?.text;

    if (!telegramId || !text?.startsWith('/')) return;

    //команды обрабатывает только владелец
    if (telegramId !== this.configService.get('OWNER_TELEGRAM_ID')) return;

    this.logger.log(`Webhook command: ${text} (tg: ${telegramId})`);

    const response = await this.botCommandService.handleCommand(text);
    await this.telegramService.sendMessageTo(telegramId, response);
  }
}
