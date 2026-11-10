import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { OnModuleDestroy } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ScheduleService } from 'src/modules/application/schedule/schedule.service';
import { SYSTEM_QUEUE, SYSTEM_SCHEDULE_TICK_JOB } from './constants/system-queue.constants';
import { SystemQueueMessages } from './constants/system-queue.messages';

@Processor(SYSTEM_QUEUE)
export class SystemQueueProcessor extends WorkerHost implements OnModuleDestroy {
  constructor(private readonly scheduleService: ScheduleService) {
    super();
  }

  async onModuleDestroy() {
    await this.worker.close();
  }

  async process(job: Job) {
    if (job.name !== SYSTEM_SCHEDULE_TICK_JOB) {
      throw new Error(`${SystemQueueMessages.UNKNOWN_JOB}: ${job.name}`);
    }
    await this.scheduleService.tick(new Date());
  }
}
