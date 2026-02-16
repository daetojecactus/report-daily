import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import { BotCommandService } from 'src/modules/application/bot-command/bot-command.service';
import type { TelegramUpdate } from 'src/modules/vendors/telegram/telegram.types';
import type { ReportDailyBotEnvs } from 'src/config/env';

const POLLING_TIMEOUT = 30;
const POLLING_ERROR_DELAY_MS = 2000;

@Injectable()
export class TelegramPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollingService.name);
  private isStopped = false;
  private offset = 0;

  constructor(
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
    private readonly telegramService: TelegramService,
    private readonly botCommandService: BotCommandService,
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

  //бесконечный цикл long polling
  private async pollLoop(): Promise<void> {
    while (!this.isStopped) {
      try {
        const updates = await this.telegramService.getUpdates({
          offset: this.offset,
          timeout: POLLING_TIMEOUT,
        });

        for (const update of updates) {
          await this.processUpdate(update);
          this.offset = update.update_id + 1;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Polling error: ${msg}`);
        await this.sleep(POLLING_ERROR_DELAY_MS);
      }
    }
  }

  //обрабатывает один update — только команды от owner
  private async processUpdate(update: TelegramUpdate): Promise<void> {
    const telegramId =
      update.message?.from?.id ??
      update.callback_query?.from?.id ??
      update.edited_message?.from?.id;

    const text = update.message?.text;

    if (!telegramId || !text?.startsWith('/')) return;
    if (telegramId !== this.configService.get('OWNER_TELEGRAM_ID')) return;

    const response = await this.botCommandService.handleCommand(text);
    await this.telegramService.sendMessageTo(telegramId, response);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
