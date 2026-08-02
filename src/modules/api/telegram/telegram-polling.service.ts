import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { TelegramCommandRouter } from 'src/modules/application/bot-command/router/telegram-command-router.service';
import { TelegramPollingMessages } from './constants/telegram-polling.messages';
import type { TelegramUpdate } from 'src/modules/vendors/telegram/telegram.interface';
import type { ReportDailyBotEnvs } from 'src/modules/infrastructure/config/env';
import {
  TELEGRAM_POLLING_ERROR_DELAY_MS,
  TELEGRAM_POLLING_TIMEOUT,
} from './constants/telegram-polling.constants';
import { getErrorMessage } from 'src/common/helpers/error.helper';
import { sleep } from 'src/common/helpers/sleep.helper';

@Injectable()
export class TelegramPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollingService.name);
  private isStopped = false;
  private offset = 0;

  constructor(
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
    private readonly telegramService: TelegramService,
    private readonly commandRouter: TelegramCommandRouter,
  ) {}

  async onModuleInit(): Promise<void> {
    const transport = this.configService.get('TELEGRAM_TRANSPORT') ?? 'webhook';
    if (transport !== 'polling') return;

    this.logger.log(TelegramPollingMessages.POLLING_ENABLED);
    await this.telegramService.enableLongPollingMode();
    void this.pollLoop();
  }

  onModuleDestroy(): void {
    this.isStopped = true;
  }

  private async pollLoop(): Promise<void> {
    while (!this.isStopped) {
      try {
        const updates = await this.telegramService.getUpdates({
          offset: this.offset,
          timeout: TELEGRAM_POLLING_TIMEOUT,
        });

        for (const update of updates) {
          //offset двигаем до обработки: иначе упавший апдейт будет
          //бесконечно возвращаться из getUpdates и блокировать очередь
          this.offset = update.update_id + 1;

          try {
            await this.processUpdate(update);
          } catch (error) {
            this.logger.error(
              `${TelegramPollingMessages.UPDATE_FAILED}: ${update.update_id}: ${getErrorMessage(error)}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `${TelegramPollingMessages.POLLING_ERROR}: ${getErrorMessage(error)}`,
        );
        await sleep(TELEGRAM_POLLING_ERROR_DELAY_MS);
      }
    }
  }

  private async processUpdate(update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.processCallbackQuery(update);
      return;
    }
    await this.processTextCommand(update);
  }

  private async processCallbackQuery(update: TelegramUpdate): Promise<void> {
    const callback = update.callback_query!;
    const telegramId = callback.from?.id;
    const chatId = callback.message?.chat?.id;
    const data = callback.data;

    if (!telegramId || !chatId || !data) return;

    const testReportAdminId = await this.commandRouter.handleCallbackQuery(
      telegramId,
      chatId,
      callback.id,
      data,
    );

    // send_user_report — специальный обработчик с синхронной генерацией
    if (testReportAdminId) {
      await this.commandRouter.executeTestReport(chatId, testReportAdminId);
    }
  }

  private async processTextCommand(update: TelegramUpdate): Promise<void> {
    const telegramId = update.message?.from?.id;
    const chatId = update.message?.chat?.id ?? telegramId;
    const text = update.message?.text;

    if (!telegramId || !chatId) return;

    await this.commandRouter.handleTextMessage(telegramId, chatId, text);
  }
}
