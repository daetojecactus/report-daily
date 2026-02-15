import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SchedulerService } from '../../application/scheduler/scheduler.service';
import { BotSettingsService } from '../../application/bot-settings/bot-settings.service';
import { BotSettingsMessages } from '../../application/bot-settings/constants/bot-settings.messages';
import { SchedulerMessages } from '../../application/scheduler/constants/scheduler.messages';

@Injectable()
export class SchedulerTask {
  private readonly logger = new Logger(SchedulerTask.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly botSettingsService: BotSettingsService,
  ) {}

  //крон каждый час — проверяет статус бота и запускает рассылку отчётов
  @Cron('0 * * * *')
  async handleReportCron(): Promise<void> {
    const canWork = await this.botSettingsService.canWork();

    if (!canWork) {
      this.logger.log(BotSettingsMessages.BOT_IS_INACTIVE);
      return;
    }

    const currentHour = new Date().getHours();
    this.logger.log(
      `${SchedulerMessages.SCHEDULER_CRON_TRIGGERED}: hour ${currentHour}`,
    );
    await this.schedulerService.sendReportsForHour(currentHour);
  }
}
