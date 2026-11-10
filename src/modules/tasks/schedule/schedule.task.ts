import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getErrorMessage } from 'src/common/utils/error.util';
import { ScheduleService } from 'src/modules/application/schedule/schedule.service';
import { SCHEDULE_TASK_NAME, SCHEDULE_TASK_PATTERN } from './constants/schedule-task.constants';
import { ScheduleTaskMessages } from './constants/schedule-task.messages';

@Injectable()
export class ScheduleTask {
  private readonly logger = new Logger(ScheduleTask.name);

  constructor(private readonly scheduleService: ScheduleService) {}

  @Cron(SCHEDULE_TASK_PATTERN, { name: SCHEDULE_TASK_NAME })
  async handleTick() {
    try {
      await this.scheduleService.tick(new Date());
    } catch (error) {
      this.logger.error({ error: getErrorMessage(error) }, ScheduleTaskMessages.TICK_FAILED);
    }
  }
}
