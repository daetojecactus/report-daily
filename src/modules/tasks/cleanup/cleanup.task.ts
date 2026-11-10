import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getErrorMessage } from 'src/common/utils/error.util';
import { SystemCleanup } from 'src/modules/application/system/system.cleanup';
import { CLEANUP_TASK_NAME, CLEANUP_TASK_PATTERN } from './constants/cleanup-task.constants';
import { CleanupTaskMessages } from './constants/cleanup-task.messages';

@Injectable()
export class CleanupTask {
  private readonly logger = new Logger(CleanupTask.name);

  constructor(private readonly systemCleanup: SystemCleanup) {}

  @Cron(CLEANUP_TASK_PATTERN, { name: CLEANUP_TASK_NAME })
  async handleCleanup() {
    try {
      await this.systemCleanup.run();
    } catch (error) {
      this.logger.error({ error: getErrorMessage(error) }, CleanupTaskMessages.CLEANUP_FAILED);
    }
  }
}
