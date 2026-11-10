import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { OnModuleDestroy } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ScheduleService } from 'src/modules/application/schedule/schedule.service';
import { SystemCleanup } from 'src/modules/application/system/system.cleanup';
import {
  SYSTEM_CLEANUP_JOB,
  SYSTEM_QUEUE,
  SYSTEM_SCHEDULE_TICK_JOB,
} from './constants/system-queue.constants';
import { SystemQueueMessages } from './constants/system-queue.messages';

@Processor(SYSTEM_QUEUE)
export class SystemQueueProcessor extends WorkerHost implements OnModuleDestroy {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly systemCleanup: SystemCleanup,
  ) {
    super();
  }

  async onModuleDestroy() {
    await this.worker.close();
  }

  async process(job: Job) {
    switch (job.name) {
      case SYSTEM_SCHEDULE_TICK_JOB:
        await this.scheduleService.tick(new Date());
        return;
      case SYSTEM_CLEANUP_JOB:
        await this.systemCleanup.run();
        return;
      default:
        throw new Error(`${SystemQueueMessages.UNKNOWN_JOB}: ${job.name}`);
    }
  }
}
