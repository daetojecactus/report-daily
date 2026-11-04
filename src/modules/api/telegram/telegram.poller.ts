import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { getErrorMessage } from 'src/common/utils/error.util';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { InboundQueueProducer } from 'src/modules/queue/inbound/inbound-queue.producer';
import { TELEGRAM_CONFLICT } from 'src/modules/vendors/telegram/constants/telegram.constants';
import {
  TelegramRejectedError,
  TelegramRetryableError,
} from 'src/modules/vendors/telegram/telegram.error';
import { TelegramService } from 'src/modules/vendors/telegram/telegram.service';
import {
  TELEGRAM_POLLER_ERROR_DELAY_MS,
  TELEGRAM_POLLER_LOCK_KEY,
  TELEGRAM_POLLER_LOCK_RETRY_MS,
  TELEGRAM_POLLER_LOCK_TTL_MS,
  TELEGRAM_POLLER_OFFSET_KEY,
  TELEGRAM_POLLER_REJECTED_DELAY_MS,
} from './constants/telegram-poller.constants';
import { TelegramPollerMessages } from './constants/telegram-poller.messages';

@Injectable()
export class TelegramPoller implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPoller.name);
  private readonly lockToken = randomUUID();
  private readonly stopController = new AbortController();
  private running: Promise<void> = Promise.resolve();
  private shouldDeleteWebhook = false;

  constructor(
    private readonly telegramService: TelegramService,
    private readonly inboundQueueProducer: InboundQueueProducer,
    private readonly redisService: RedisService,
  ) {}

  onApplicationBootstrap() {
    this.running = this.run();
  }

  async onModuleDestroy() {
    this.stopController.abort();
    await this.running;
  }

  private async run() {
    const { signal } = this.stopController;
    while (!signal.aborted) {
      const delayMs = await this.poll(signal);
      if (delayMs > 0) {
        await this.wait(delayMs, signal);
      }
    }
    await this.releaseLock();
  }

  private async poll(signal: AbortSignal) {
    try {
      const isLocked = await this.redisService.acquireLock(
        TELEGRAM_POLLER_LOCK_KEY,
        this.lockToken,
        TELEGRAM_POLLER_LOCK_TTL_MS,
      );
      if (!isLocked) {
        return TELEGRAM_POLLER_LOCK_RETRY_MS;
      }
      if (this.shouldDeleteWebhook) {
        await this.telegramService.deleteWebhook();
        this.shouldDeleteWebhook = false;
      }

      const offset = Number(
        await this.redisService.get(TELEGRAM_POLLER_OFFSET_KEY),
      );
      const updates = await this.telegramService.getUpdates(offset, signal);
      for (const update of updates) {
        const event = this.telegramService.toChatEvent(update);
        if (event) {
          await this.inboundQueueProducer.addTelegramEvent(
            update.update_id,
            event,
          );
        }
      }
      const last = updates.at(-1);
      if (last) {
        await this.redisService.set(
          TELEGRAM_POLLER_OFFSET_KEY,
          String(last.update_id + 1),
        );
      }
      return 0;
    } catch (error) {
      return signal.aborted ? 0 : this.getRetryDelay(error);
    }
  }

  private getRetryDelay(error: unknown) {
    if (
      error instanceof TelegramRejectedError &&
      error.code === TELEGRAM_CONFLICT
    ) {
      this.logger.warn(TelegramPollerMessages.POLLING_CONFLICT);
      this.shouldDeleteWebhook = true;
      return TELEGRAM_POLLER_ERROR_DELAY_MS;
    }
    if (error instanceof TelegramRejectedError) {
      this.logger.error(
        `${TelegramPollerMessages.POLLING_REJECTED}: ${error.message}`,
      );
      return TELEGRAM_POLLER_REJECTED_DELAY_MS;
    }

    this.logger.warn(
      `${TelegramPollerMessages.POLLING_FAILED}: ${getErrorMessage(error)}`,
    );
    if (error instanceof TelegramRetryableError && error.retryAfterSeconds) {
      return error.retryAfterSeconds * 1000;
    }
    return TELEGRAM_POLLER_ERROR_DELAY_MS;
  }

  private async wait(delayMs: number, signal: AbortSignal) {
    try {
      await sleep(delayMs, undefined, { signal });
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    }
  }

  private async releaseLock() {
    try {
      await this.redisService.releaseLock(
        TELEGRAM_POLLER_LOCK_KEY,
        this.lockToken,
      );
    } catch (error) {
      this.logger.warn(
        `${TelegramPollerMessages.LOCK_RELEASE_FAILED}: ${getErrorMessage(error)}`,
      );
    }
  }
}
