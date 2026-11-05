import { Injectable } from '@nestjs/common';
import { countDistinct, sql, type SQL } from 'drizzle-orm';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import type { LabelMappingInsert, LabelMappingUpdate } from './label.interface';
import { labelMappings } from './label.schema';

@Injectable()
export class LabelRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  find(filter?: SQL) {
    return this.databaseService.db.select().from(labelMappings).where(filter);
  }

  async findOne(filter: SQL) {
    const [mapping] = await this.databaseService.db
      .select()
      .from(labelMappings)
      .where(filter)
      .limit(1);
    return mapping ?? null;
  }

  async create(values: LabelMappingInsert) {
    const [mapping] = await this.databaseService.db
      .insert(labelMappings)
      .values(values)
      .returning();
    return mapping;
  }

  async updateOne(filter: SQL, values: LabelMappingUpdate) {
    const [mapping] = await this.databaseService.db
      .update(labelMappings)
      .set(values)
      .where(filter)
      .returning();
    return mapping ?? null;
  }

  async deleteOne(filter: SQL) {
    const [mapping] = await this.databaseService.db
      .delete(labelMappings)
      .where(filter)
      .returning();
    return mapping ?? null;
  }

  deleteMany(filter: SQL) {
    return this.databaseService.db
      .delete(labelMappings)
      .where(filter)
      .returning();
  }

  async countLabels() {
    const [row] = await this.databaseService.db
      .select({ count: countDistinct(labelMappings.labelKey) })
      .from(labelMappings);
    return row?.count ?? 0;
  }

  findLabelPage(limit: number, offset: number) {
    return this.databaseService.db
      .selectDistinctOn([labelMappings.labelKey])
      .from(labelMappings)
      .orderBy(
        labelMappings.labelKey,
        sql`${labelMappings.role} asc nulls first`,
        labelMappings.createdAt,
      )
      .limit(limit)
      .offset(offset);
  }

  async createIfMissing(values: LabelMappingInsert) {
    const [mapping] = await this.databaseService.db
      .insert(labelMappings)
      .values(values)
      .onConflictDoNothing()
      .returning();
    return mapping ?? null;
  }
}
