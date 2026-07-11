import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { ReportService } from '../report/report.service';
import { TelegramService } from '../../vendors/telegram/telegram.service';
import { ReportQueueProducer } from 'src/modules/queue/report/report-queue.producer';
import { SchedulerMessages } from './constants/scheduler.messages';
import {
  RECENT_REPORTS_DEFAULT_DAYS,
  RECENT_REPORTS_MAX_DAYS,
  SCHEDULER_MAX_RETRIES,
} from './constants/scheduler.constants';
import type { User } from '../user/user.schema';
import type {
  BatchUserResult,
  RecentReportsSummary,
} from './scheduler.interface';
import { UserMessages } from '../user/constants/user.messages';
import { UserStatus } from '../user/user.enums';
import { DefaultMessages } from 'src/common/constants/default.messages';
import {
  buildRecentDates,
  formatDateToISO,
} from 'src/common/helpers/date.helper';
import { getErrorMessage } from 'src/common/helpers/error.helper';
import { sleep } from 'src/common/helpers/sleep.helper';
import { Language, getLocale } from 'src/common/i18n/i18n';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly userService: UserService,
    private readonly reportService: ReportService,
    private readonly telegramService: TelegramService,
    private readonly reportQueueProducer: ReportQueueProducer,
  ) {}

  //генерирует и отправляет отчеты для всех пользователей на указанный час через очередь
  async sendReportsForHour(hour: number): Promise<void> {
    const users = await this.userService.findUsersByReportHour(hour);

    if (users.length === 0) {
      this.logger.log(`${SchedulerMessages.SCHEDULER_NO_USERS}: hour ${hour}`);
      return;
    }

    this.logger.log(
      `${SchedulerMessages.SCHEDULER_FOUND_USERS}: ${users.length} user(s), hour ${hour}`,
    );

    const date = formatDateToISO();

    //добавляем всех пользователей в очередь одним батчем
    const jobs = users.map((user) => ({
      adminId: user.adminId,
      telegramId: user.telegramId,
      date,
      language: user.settings?.language ?? Language.RU,
    }));

    await this.reportQueueProducer.addBatchReportJobs(jobs);

    this.logger.log(
      `${SchedulerMessages.SCHEDULER_BATCH_QUEUED}: ${users.length} job(s), hour ${hour}`,
    );
  }

  //генерирует и отправляет отчет для одного пользователя по adminId (синхронно, для ручного запуска)
  async sendReportForUser(
    adminId: string,
    date?: string,
  ): Promise<BatchUserResult> {
    const user = await this.userService.findOne({ adminId });
    if (!user) {
      this.logger.warn(`${UserMessages.USER_NOT_FOUND}: ${adminId}`);
      return { adminId, telegramId: 0, success: false };
    }

    return this.processOneUser(user, date ?? formatDateToISO());
  }

  //ручная массовая рассылка: всем активным пользователям отчёты за последние N дней
  async sendRecentReportsToAllUsers(
    days?: number,
  ): Promise<RecentReportsSummary> {
    const normalizedDays = this.normalizeRecentDays(days);
    const dates = buildRecentDates(normalizedDays);
    const users = await this.userService.find({ status: UserStatus.ACTIVE });

    const results: BatchUserResult[] = [];
    //последовательно, чтобы не упереться в лимиты telegram/gitlab
    for (const user of users) {
      for (const date of dates) {
        results.push(await this.processOneUser(user, date));
      }
    }

    return {
      days: normalizedDays,
      dates,
      users: users.length,
      sent: results.length,
      failed: results.filter((result) => !result.success).length,
      results,
    };
  }

  //нормализует запрошенное количество дней: дефолт и границы [1, RECENT_REPORTS_MAX_DAYS]
  private normalizeRecentDays(days?: number): number {
    if (days === undefined || Number.isNaN(days)) {
      return RECENT_REPORTS_DEFAULT_DAYS;
    }
    return Math.min(Math.max(Math.trunc(days), 1), RECENT_REPORTS_MAX_DAYS);
  }

  //генерация + отправка для одного пользователя с retry (для ручных запросов)
  private async processOneUser(
    user: User,
    date: string,
  ): Promise<BatchUserResult> {
    const { adminId, telegramId } = user;

    for (let attempt = 1; attempt <= SCHEDULER_MAX_RETRIES + 1; attempt++) {
      try {
        const report = await this.reportService.generateReport(adminId, date);

        if (!report.text || report.projects.length === 0) {
          this.logger.warn(
            `${SchedulerMessages.SCHEDULER_EMPTY_REPORT}: ${adminId}`,
          );
          const language = user.settings?.language ?? Language.RU;
          const locale = getLocale(language);
          await this.telegramService.sendMessageTo(
            telegramId,
            locale.report.noActivity,
          );
          return { adminId, telegramId, success: true };
        }

        await this.telegramService.sendMessageTo(telegramId, report.text);
        return { adminId, telegramId, success: true };
      } catch (error) {
        const errMsg = getErrorMessage(error);

        if (attempt <= SCHEDULER_MAX_RETRIES) {
          this.logger.warn(
            `${SchedulerMessages.SCHEDULER_ATTEMPT_FAILED}: attempt ${attempt}, ${adminId}: ${errMsg}`,
          );
          await sleep(2000 * attempt);
        } else {
          this.logger.error(
            `${SchedulerMessages.SCHEDULER_ALL_FAILED}: ${adminId}: ${errMsg}`,
          );
          return {
            adminId,
            telegramId,
            success: false,
            error: errMsg,
          };
        }
      }
    }

    return {
      adminId,
      telegramId,
      success: false,
      error: DefaultMessages.DEFAULT_UNKNOWN_ERROR,
    };
  }
}
