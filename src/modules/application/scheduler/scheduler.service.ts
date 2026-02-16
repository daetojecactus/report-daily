import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { ReportService } from '../report/report.service';
import { TelegramService } from '../../vendors/telegram/telegram.service';
import { SchedulerMessages } from './constants/scheduler.messages';
import {
  SCHEDULER_MAX_RETRIES,
  SCHEDULER_SEND_DELAY_MS,
} from './constants/scheduler.constants';
import type { User } from '../user/user.schema';
import type { BatchUserResult } from './scheduler.types';
import { UserMessages } from '../user/constants/user.messages';
import { ReportMessages } from '../report/constants/report.messages';
import { DefaultMessages } from 'src/common/constants/defautl.messages';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly userService: UserService,
    private readonly reportService: ReportService,
    private readonly telegramService: TelegramService,
  ) {}

  //генерирует и отправляет отчеты для всех пользователей на указанный час
  async sendReportsForHour(hour: number): Promise<BatchUserResult[]> {
    const users = await this.userService.findByReportHour(hour);

    if (users.length === 0) {
      this.logger.log(`${SchedulerMessages.SCHEDULER_NO_USERS}: hour ${hour}`);
      return [];
    }

    this.logger.log(
      `${SchedulerMessages.SCHEDULER_FOUND_USERS}: ${users.length} user(s), hour ${hour}`,
    );
    const today = new Date().toISOString().split('T')[0]!;

    return this.processBatch(users, today);
  }

  //генерирует и отправляет отчет для одного пользователя по adminId
  async sendReportForUser(
    adminId: string,
    date?: string,
  ): Promise<BatchUserResult> {
    const user = await this.userService.findOne({ adminId });
    if (!user) {
      this.logger.warn(`${UserMessages.USER_NOT_FOUND}: ${adminId}`);
      return { adminId, telegramId: 0, success: false };
    }

    const targetDate = date ?? new Date().toISOString().split('T')[0]!;
    return this.processOneUser(user, targetDate);
  }

  //обрабатывает батч пользователей последовательно с задержкой
  private async processBatch(
    users: User[],
    date: string,
  ): Promise<BatchUserResult[]> {
    const results: BatchUserResult[] = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i]!;

      if (i > 0) {
        await this.sleep(SCHEDULER_SEND_DELAY_MS);
      }

      const result = await this.processOneUser(user, date);
      results.push(result);
    }

    const succeeded = results.filter((result) => result.success).length;
    const failed = results.filter((result) => !result.success).length;
    this.logger.log(
      `${SchedulerMessages.SCHEDULER_BATCH_DONE}: ${succeeded} sent, ${failed} failed`,
    );

    return results;
  }

  //генерация + отправка для одного пользователя с retry
  private async processOneUser(
    user: User,
    date: string,
  ): Promise<BatchUserResult> {
    const { adminId, telegramId } = user;

    this.logger.log(
      `${SchedulerMessages.SCHEDULER_PROCESSING}: ${adminId} (tg: ${telegramId})`,
    );

    for (let attempt = 1; attempt <= SCHEDULER_MAX_RETRIES + 1; attempt++) {
      try {
        const report = await this.reportService.generateReport(adminId, date);

        if (!report.text || report.projects.length === 0) {
          this.logger.warn(
            `${SchedulerMessages.SCHEDULER_EMPTY_REPORT}: ${adminId}`,
          );
          return { adminId, telegramId, success: true };
        }

        await this.telegramService.sendMessageTo(telegramId, report.text);
        this.logger.log(
          `${ReportMessages.REPORT_SENT}: ${adminId} (tg: ${telegramId})`,
        );
        return { adminId, telegramId, success: true };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);

        if (attempt <= SCHEDULER_MAX_RETRIES) {
          this.logger.warn(
            `${SchedulerMessages.SCHEDULER_ATTEMPT_FAILED}: attempt ${attempt}, ${adminId}: ${errMsg}`,
          );
          await this.sleep(2000 * attempt);
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
