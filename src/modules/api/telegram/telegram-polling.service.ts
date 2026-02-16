import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { BotCommandService } from 'src/modules/application/bot-command/bot-command.service';
import { SchedulerService } from 'src/modules/application/scheduler/scheduler.service';
import { BotCommandMessages } from 'src/modules/application/bot-command/constants/bot-command.messages';
import type { TelegramUpdate } from 'src/modules/vendors/telegram/telegram.types';
import type { ReportDailyBotEnvs } from 'src/config/env';
import {
  BotCommand,
  CommandResult,
} from 'src/modules/application/bot-command/bot-command.types';
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
    private readonly botCommandService: BotCommandService,
    private readonly schedulerService: SchedulerService,
  ) {}

  async onModuleInit(): Promise<void> {
    const transport = this.configService.get('TELEGRAM_TRANSPORT') ?? 'webhook';
    if (transport !== 'polling') return;

    this.logger.log('Telegram polling mode enabled');
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
        this.logger.error(`Polling error: ${getErrorMessage(error)}`);
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

    if (result.text.startsWith('__TEST_REPORT__:')) {
      const adminId = result.text.split(':')[1]!;
      await this.executeTestReport(chatId, adminId);
      return;
    }

    await this.sendCommandResult(chatId, result);
  }

  private async processTextCommand(update: TelegramUpdate): Promise<void> {
    const telegramId = update.message?.from?.id;
    const chatId = update.message?.chat?.id ?? telegramId;
    const text = update.message?.text;

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

  private async executeTestReport(
    chatId: number,
    adminId: string,
  ): Promise<void> {
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
