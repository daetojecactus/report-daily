import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { BotCommandService } from 'src/modules/application/bot-command/bot-command.service';
import type { TelegramUpdate } from 'src/modules/vendors/telegram/telegram.types';
import type { ReportDailyBotEnvs } from 'src/config/env';
import {
  BotCommand,
  CommandResult,
} from 'src/modules/application/bot-command/bot-command.types';

@Controller('telegram')
export class TelegramWebhookController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly botCommandService: BotCommandService,
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
      await this.handleCallbackQuery(body);
      return;
    }

    await this.handleTextCommand(body);
  }

  private async handleCallbackQuery(body: TelegramUpdate): Promise<void> {
    const callback = body.callback_query!;
    const telegramId = callback.from?.id;
    const chatId = callback.message?.chat?.id;
    const data = callback.data;

    if (!telegramId || !chatId || !data) return;

    if (telegramId !== this.configService.get('OWNER_TELEGRAM_ID')) {
      await this.telegramService.answerCallbackQuery(callback.id);
      return;
    }

    await this.telegramService.answerCallbackQuery(callback.id);

    let result: CommandResult;

    if (data.startsWith('uf:')) {
      result = await this.botCommandService.handleFieldCallback(data);
    } else if (data.startsWith('uv:')) {
      result = await this.botCommandService.handleValueCallback(data);
    } else {
      result = await this.botCommandService.handleCallback(data);
    }

    await this.sendCommandResult(chatId, result);
  }

  private async handleTextCommand(body: TelegramUpdate): Promise<void> {
    const telegramId = body.message?.from?.id;
    const chatId = body.message?.chat?.id ?? telegramId;
    const text = body.message?.text;

    if (!telegramId || !chatId || !text?.startsWith('/')) return;

    if (text.toLowerCase().startsWith(BotCommand.START)) {
      const response =
        await this.botCommandService.handleStartCommand(telegramId);
      if (response) await this.telegramService.sendMessageTo(chatId, response);
      return;
    }

    if (telegramId !== this.configService.get('OWNER_TELEGRAM_ID')) return;

    const result = await this.botCommandService.handleCommand(text);
    await this.sendCommandResult(chatId, result);
  }

  private async sendCommandResult(
    chatId: number,
    result: CommandResult,
  ): Promise<void> {
    if (result.keyboard) {
      await this.telegramService.sendMessageWithKeyboard(
        chatId,
        result.text,
        result.keyboard,
      );
    } else {
      await this.telegramService.sendMessageTo(chatId, result.text);
    }
  }
}
