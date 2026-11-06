import { Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import type { TraitMappingInsert, TraitMappingUpdate } from './trait.interface';
import { traitMappings } from './trait.schema';

@Injectable()
export class TraitRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  find(filter?: SQL) {
    return this.databaseService.db.select().from(traitMappings).where(filter);
  }

  async findOne(filter: SQL) {
    const [mapping] = await this.databaseService.db
      .select()
      .from(traitMappings)
      .where(filter)
      .limit(1);
    return mapping ?? null;
  }

  async create(values: TraitMappingInsert) {
    const [mapping] = await this.databaseService.db
      .insert(traitMappings)
      .values(values)
      .returning();
    return mapping;
  }

  async updateOne(filter: SQL, values: TraitMappingUpdate) {
    const [mapping] = await this.databaseService.db
      .update(traitMappings)
      .set(values)
      .where(filter)
      .returning();
    return mapping ?? null;
  }

  async deleteOne(filter: SQL) {
    const [mapping] = await this.databaseService.db.delete(traitMappings).where(filter).returning();
    return mapping ?? null;
  }

  deleteMany(filter: SQL) {
    return this.databaseService.db.delete(traitMappings).where(filter).returning();
  }

  async countSourceNames() {
    const [row] = await this.databaseService.db
      .select({
        count: sql<number>`count(distinct (${traitMappings.source}, ${traitMappings.sourceKey}))::integer`,
      })
      .from(traitMappings);
    return row?.count ?? 0;
  }

  findSourceNamePage(limit: number, offset: number) {
    return this.databaseService.db
      .selectDistinctOn([traitMappings.source, traitMappings.sourceKey])
      .from(traitMappings)
      .orderBy(
        traitMappings.source,
        traitMappings.sourceKey,
        sql`${traitMappings.role} asc nulls first`,
        traitMappings.createdAt,
      )
      .limit(limit)
      .offset(offset);
  }

  async createIfMissing(values: TraitMappingInsert) {
    const [mapping] = await this.databaseService.db
      .insert(traitMappings)
      .values(values)
      .onConflictDoNothing()
      .returning();
    return mapping ?? null;
  }
}
