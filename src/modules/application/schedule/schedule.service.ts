import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel } from 'src/common/enums/channel.enums';
import { getErrorMessage } from 'src/common/utils/error.util';
import { ReportService } from 'src/modules/application/report/report.service';
import { SettingsService } from 'src/modules/application/settings/settings.service';
import type { User } from 'src/modules/application/user/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { ReportQueueProducer } from 'src/modules/queue/report/report-queue.producer';
import { SCHEDULE_CATCH_UP_MS, SCHEDULE_REPORT_MAX_AGE_MS } from './constants/schedule.constants';
import { ScheduleMessages } from './constants/schedule.messages';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);
  private readonly timeZone: string;

  constructor(
    private readonly userService: UserService,
    private readonly reportService: ReportService,
    private readonly settingsService: SettingsService,
    private readonly reportQueueProducer: ReportQueueProducer,
    configService: ConfigService<AppEnvs, true>,
  ) {
    this.timeZone = configService.get('APP_TIMEZONE', { infer: true });
  }

  async tick(now: Date) {
    const settings = await this.settingsService.findOne();
    let queued = 0;
    for (const user of await this.userService.findScheduled(Channel.TELEGRAM)) {
      const date = this.findDueDate(user, now);
      if (!date || this.settingsService.toReportsPause(settings, date)) {
        continue;
      }
      if (await this.queue(user.id, date, now)) {
        queued++;
      }
    }
    if (queued > 0) {
      this.logger.log({ queued }, ScheduleMessages.QUEUED);
    }
    return queued;
  }

  private findDueDate(user: User, now: Date) {
    const timeZone = user.timezone ?? this.timeZone;
    const today = Temporal.Instant.fromEpochMilliseconds(now.getTime())
      .toZonedDateTimeISO(timeZone)
      .toPlainDate();
    const plainTime = Temporal.PlainTime.from(user.reportTime);
    for (const date of [today, today.subtract({ days: 1 })]) {
      const elapsed =
        now.getTime() - date.toZonedDateTime({ timeZone, plainTime }).epochMilliseconds;
      if (elapsed >= 0 && elapsed < SCHEDULE_CATCH_UP_MS) {
        return date.toString();
      }
    }
    return null;
  }

  private async queue(userId: string, date: string, now: Date) {
    if (!(await this.reportService.claimScheduled(userId, date, now))) {
      return false;
    }
    try {
      await this.reportQueueProducer.addReport({
        userId,
        date,
        maxAgeMs: SCHEDULE_REPORT_MAX_AGE_MS,
        own: false,
        notice: null,
      });
      return true;
    } catch (error) {
      await this.reportService.releaseScheduled(userId, date);
      this.logger.warn(
        { userId, date, error: getErrorMessage(error) },
        ScheduleMessages.NOT_QUEUED,
      );
      return false;
    }
  }
}
