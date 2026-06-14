import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramCommandRouter } from 'src/modules/application/bot-command/router/telegram-command-router.service';
import type { TelegramUpdate } from 'src/modules/vendors/telegram/telegram.interface';
import type { ReportDailyBotEnvs } from 'src/modules/infrastructure/config/env';

@Controller('telegram')
export class TelegramWebhookController {
  constructor(
    private readonly commandRouter: TelegramCommandRouter,
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token') token: string,
    @Body() body: TelegramUpdate,
  ): Promise<void> {
    if (token !== this.configService.get('TELEGRAM_BOT_SECRET_TOKEN')) return;

    if (body.callback_query) {
      const callback = body.callback_query;
      const telegramId = callback.from?.id;
      const chatId = callback.message?.chat?.id;
      const data = callback.data;

      if (!telegramId || !chatId || !data) return;

      await this.commandRouter.handleCallbackQuery(
        telegramId,
        chatId,
        callback.id,
        data,
      );
      return;
    }

    const telegramId = body.message?.from?.id;
    const chatId = body.message?.chat?.id ?? telegramId;
    const text = body.message?.text;

    if (!telegramId || !chatId) return;

    await this.commandRouter.handleTextMessage(telegramId, chatId, text);
  }
}
