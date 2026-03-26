import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { SchedulerService } from 'src/modules/application/scheduler/scheduler.service';
import { TelegramCommandRouter } from './telegram-command-router.service';
import { BotCommandMessages } from 'src/modules/application/bot-command/constants/bot-command.messages';
import { TelegramPollingMessages } from './constants/telegram-polling.messages';
import type { TelegramUpdate } from 'src/modules/vendors/telegram/telegram.types';
import type { ReportDailyBotEnvs } from 'src/modules/config/env';
import {
  TELEGRAM_POLLING_ERROR_DELAY_MS,
  TELEGRAM_POLLING_TIMEOUT,
} from './constants/telegram-polling.constants';
import { formatDateToISO } from 'src/common/helpers/date.helper';
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
    private readonly schedulerService: SchedulerService,
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
          await this.processUpdate(update);
          this.offset = update.update_id + 1;
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
      await this.executeTestReport(chatId, testReportAdminId);
    }
  }

  private async processTextCommand(update: TelegramUpdate): Promise<void> {
    const telegramId = update.message?.from?.id;
    const chatId = update.message?.chat?.id ?? telegramId;
    const text = update.message?.text;

    if (!telegramId || !chatId) return;

    await this.commandRouter.handleTextMessage(telegramId, chatId, text);
  }

  // выполнение тестового отчёта (вызывается из роутера через sendResult)
  async executeTestReport(chatId: number, adminId: string): Promise<void> {
    const date = formatDateToISO();

    try {
      await this.telegramService.sendMessageTo(
        chatId,
        `${BotCommandMessages.REPORT_GENERATING} ${adminId} (${date})...`,
      );
      await this.schedulerService.sendReportForUser(adminId, date);
      await this.telegramService.sendMessageTo(
        chatId,
        `${BotCommandMessages.REPORT_SENT}: ${adminId} (${date})`,
      );
    } catch (error) {
      await this.telegramService.sendMessageTo(
        chatId,
        `${BotCommandMessages.REPORT_ERROR}: ${getErrorMessage(error)}`,
      );
    }
  }
}
