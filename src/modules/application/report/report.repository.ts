import { Injectable } from '@nestjs/common';
import { desc, isNull, type SQL } from 'drizzle-orm';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import { ReportStatus } from './types/report.enums';
import type { ReportInsert, ReportUpdate } from './types/report.interface';
import { reports } from './report.schema';

@Injectable()
export class ReportRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  find(filter?: SQL) {
    return this.databaseService.db.select().from(reports).where(filter);
  }

  async findOne(filter: SQL) {
    const [report] = await this.databaseService.db.select().from(reports).where(filter).limit(1);
    return report ?? null;
  }

  async findLatest(filter: SQL) {
    const [report] = await this.databaseService.db
      .select()
      .from(reports)
      .where(filter)
      .orderBy(desc(reports.reportDate))
      .limit(1);
    return report ?? null;
  }

  async updateOne(filter: SQL, values: ReportUpdate) {
    const [report] = await this.databaseService.db
      .update(reports)
      .set(values)
      .where(filter)
      .returning();
    return report ?? null;
  }

  async claimScheduled(userId: string, reportDate: string, scheduledAt: Date) {
    const [report] = await this.databaseService.db
      .insert(reports)
      .values({ userId, reportDate, status: ReportStatus.PENDING, scheduledAt })
      .onConflictDoUpdate({
        target: [reports.userId, reports.reportDate],
        set: { scheduledAt },
        setWhere: isNull(reports.scheduledAt),
      })
      .returning();
    return report ?? null;
  }

  async deleteMany(filter: SQL) {
    const result = await this.databaseService.db.delete(reports).where(filter);
    return result.rowCount ?? 0;
  }

  async upsert(values: ReportInsert) {
    const [report] = await this.databaseService.db
      .insert(reports)
      .values(values)
      .onConflictDoUpdate({
        target: [reports.userId, reports.reportDate],
        set: {
          status: values.status,
          snapshot: values.snapshot,
          content: values.content,
          error: values.error,
          generatedAt: values.generatedAt,
          templateId: values.templateId,
          aiUsed: values.aiUsed,
          aiModel: values.aiModel,
          updatedAt: new Date(),
        },
      })
      .returning();
    return report;
  }
}
