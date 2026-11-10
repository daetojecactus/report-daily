import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  SYSTEM_JOB_OPTIONS,
  SYSTEM_QUEUE,
  SYSTEM_SCHEDULE_TICK_JOB,
  SYSTEM_SCHEDULE_TICK_PATTERN,
  SYSTEM_SCHEDULE_TICK_SCHEDULER_ID,
} from './constants/system-queue.constants';

@Injectable()
export class SystemQueueProducer {
  constructor(@InjectQueue(SYSTEM_QUEUE) private readonly systemQueue: Queue) {}

  async scheduleTick() {
    await this.systemQueue.upsertJobScheduler(
      SYSTEM_SCHEDULE_TICK_SCHEDULER_ID,
      { pattern: SYSTEM_SCHEDULE_TICK_PATTERN },
      { name: SYSTEM_SCHEDULE_TICK_JOB, opts: SYSTEM_JOB_OPTIONS },
    );
  }
}
