import { Injectable } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import type { ReportInsert } from './report.interface';
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
          updatedAt: new Date(),
        },
      })
      .returning();
    return report;
  }
}
