import { Injectable } from '@nestjs/common';
import { asc, sql, type SQL } from 'drizzle-orm';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import type { ReportTemplateInsert, ReportTemplateUpdate } from './template.interface';
import { reportTemplates } from './template.schema';

@Injectable()
export class TemplateRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  find(filter?: SQL) {
    return this.databaseService.db
      .select()
      .from(reportTemplates)
      .where(filter)
      .orderBy(sql`${reportTemplates.ownerId} nulls first`, asc(reportTemplates.name));
  }

  async findOne(filter: SQL) {
    const [template] = await this.databaseService.db
      .select()
      .from(reportTemplates)
      .where(filter)
      .limit(1);
    return template ?? null;
  }

  async create(values: ReportTemplateInsert) {
    const [template] = await this.databaseService.db
      .insert(reportTemplates)
      .values(values)
      .returning();
    return template;
  }

  async updateOne(filter: SQL, values: ReportTemplateUpdate) {
    const [template] = await this.databaseService.db
      .update(reportTemplates)
      .set(values)
      .where(filter)
      .returning();
    return template ?? null;
  }

  async deleteOne(filter: SQL) {
    const [template] = await this.databaseService.db
      .delete(reportTemplates)
      .where(filter)
      .returning();
    return template ?? null;
  }
}
