import { WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { finishesWithin } from 'src/common/utils/timeout.util';
import { QUEUE_STOP_TIMEOUT_MS } from './constants/queue.constants';
import { QueueMessages } from './constants/queue.messages';

export abstract class QueueHost extends WorkerHost implements OnModuleDestroy {
  protected readonly logger = new Logger(this.constructor.name);

  async onModuleDestroy() {
    if (!(await finishesWithin(this.worker.close(), QUEUE_STOP_TIMEOUT_MS))) {
      this.logger.warn({ timeoutMs: QUEUE_STOP_TIMEOUT_MS }, QueueMessages.STOP_TIMED_OUT);
    }
  }
}
