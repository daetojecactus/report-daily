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
import { UserService } from 'src/modules/application/user/user.service';
import { UserStatus } from 'src/modules/application/user/user.interface';
import type { TelegramUpdate } from 'src/modules/vendors/telegram/telegram.types';

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  //обработка входящих обновлений от telegram
  //игнорирует пользователей которых нет в базе
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token') token: string,
    @Body() body: TelegramUpdate,
  ): Promise<void> {
    //проверка секретного токена
    if (token !== this.configService.get('TELEGRAM_BOT_SECRET_TOKEN')) return;

    //извлекаем telegramId отправителя
    const telegramId = this.extractTelegramId(body);
    if (!telegramId) return;

    //проверяем есть ли пользователь в базе
    const user = await this.userService.findOne({ telegramId });
    if (!user || user.status !== UserStatus.ACTIVE) return;

    //пользователь найден — обработка сообщения
    this.logger.log(
      `Webhook received from ${user.adminId} (tg: ${telegramId})`,
    );
  }

  //извлекает telegramId из update body
  private extractTelegramId(body: TelegramUpdate): number | null {
    return (
      body.message?.from?.id ??
      body.callback_query?.from?.id ??
      body.edited_message?.from?.id ??
      null
    );
  }
}
