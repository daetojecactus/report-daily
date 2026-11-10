import { Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, inArray, type SQL } from 'drizzle-orm';
import { getErrorMessage } from 'src/common/utils/error.util';
import { DEFAULT_LANGUAGE } from 'src/modules/application/i18n/constants/i18n.constants';
import { UserService } from 'src/modules/application/user/user.service';
import { UserSourceService } from 'src/modules/application/user/user-source/user-source.service';
import { REPORT_REUSABLE_STATUSES, REPORT_SNAPSHOT_STATUSES } from './constants/report.constants';
import { ReportMessages } from './constants/report.messages';
import { ReportComposer } from './report.composer';
import { ReportStatus } from './report.enums';
import type { ReportInsert } from './report.interface';
import { ReportRepository } from './report.repository';
import { reports } from './report.schema';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly reportComposer: ReportComposer,
    private readonly userService: UserService,
    private readonly userSourceService: UserSourceService,
  ) {}

  find(filter?: SQL) {
    return this.reportRepository.find(filter);
  }

  findOne(filter: SQL) {
    return this.reportRepository.findOne(filter);
  }

  save(values: ReportInsert) {
    return this.reportRepository.upsert(values);
  }

  findById(id: string) {
    return this.findOne(eq(reports.id, id));
  }

  markDelivered(id: string) {
    return this.reportRepository.updateOne(eq(reports.id, id), {
      status: ReportStatus.DELIVERED,
    });
  }

  findLatestSnapshot(userId: string) {
    return this.reportRepository.findLatest(
      and(eq(reports.userId, userId), inArray(reports.status, REPORT_SNAPSHOT_STATUSES))!,
    );
  }

  findLatest(userId: string) {
    return this.reportRepository.findLatest(eq(reports.userId, userId));
  }

  findFresh(userId: string, reportDate: string, maxAgeMs: number | null) {
    return this.findOne(
      and(
        eq(reports.userId, userId),
        eq(reports.reportDate, reportDate),
        inArray(reports.status, REPORT_REUSABLE_STATUSES),
        maxAgeMs === null ? undefined : gte(reports.generatedAt, new Date(Date.now() - maxAgeMs)),
      )!,
    );
  }

  findByDate(userId: string, reportDate: string) {
    return this.findOne(and(eq(reports.userId, userId), eq(reports.reportDate, reportDate))!);
  }

  async build(userId: string, reportDate: string) {
    const user = await this.userService.findById(userId);
    const [account] = await this.userSourceService.findByUser(userId);
    if (!user || !account) {
      throw new Error(`${ReportMessages.EMPLOYEE_NOT_FOUND}: ${userId}`);
    }
    await this.save({ userId, reportDate, status: ReportStatus.GENERATING, error: null });
    try {
      const { context, content, templateId } = await this.reportComposer.compose({
        user,
        account,
        date: reportDate,
        language: user.language ?? DEFAULT_LANGUAGE,
      });
      const report = await this.save({
        userId,
        reportDate,
        status: context.isEmpty ? ReportStatus.EMPTY : ReportStatus.READY,
        snapshot: context,
        content,
        templateId,
        error: null,
        generatedAt: new Date(),
      });
      this.logger.log(
        { userId, reportDate, status: report.status, lines: context.itemsCount },
        ReportMessages.BUILT,
      );
      return report;
    } catch (error) {
      await this.save({
        userId,
        reportDate,
        status: ReportStatus.FAILED,
        error: getErrorMessage(error),
      });
      this.logger.warn(
        { userId, reportDate, error: getErrorMessage(error) },
        ReportMessages.FAILED,
      );
      throw error;
    }
  }
}
