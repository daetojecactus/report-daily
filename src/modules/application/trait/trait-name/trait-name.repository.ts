import { Injectable } from '@nestjs/common';
import { and, count, eq, notExists, sql, type SQL } from 'drizzle-orm';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import { traitMappings } from '../trait.schema';
import type { TraitNameInsert, TraitNameUpdate } from './types/trait-name.interface';
import { traitNames } from './trait-name.schema';

@Injectable()
export class TraitNameRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  find(filter?: SQL) {
    return this.databaseService.db.select().from(traitNames).where(filter);
  }

  async findOne(filter: SQL) {
    const [name] = await this.databaseService.db.select().from(traitNames).where(filter).limit(1);
    return name ?? null;
  }

  async updateOne(filter: SQL, values: TraitNameUpdate) {
    const [name] = await this.databaseService.db
      .update(traitNames)
      .set(values)
      .where(filter)
      .returning();
    return name ?? null;
  }

  async markSeen(values: TraitNameInsert[]) {
    await this.databaseService.db
      .insert(traitNames)
      .values(values)
      .onConflictDoUpdate({
        target: [traitNames.source, traitNames.sourceKey],
        set: { seenAt: sql`now()` },
      });
  }

  findUnmapped(filter: SQL) {
    return this.find(and(filter, this.toUnmappedFilter()));
  }

  async countUnmapped(filter: SQL) {
    const [row] = await this.databaseService.db
      .select({ count: count() })
      .from(traitNames)
      .where(and(filter, this.toUnmappedFilter()));
    return row?.count ?? 0;
  }

  findUnmappedPage(filter: SQL, limit: number, offset: number) {
    return this.findUnmapped(filter).orderBy(traitNames.sourceKey).limit(limit).offset(offset);
  }

  private toUnmappedFilter() {
    return notExists(
      this.databaseService.db
        .select({ id: traitMappings.id })
        .from(traitMappings)
        .where(
          and(
            eq(traitMappings.source, traitNames.source),
            eq(traitMappings.sourceKey, traitNames.sourceKey),
          ),
        ),
    );
  }
}
