import { Injectable } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
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
}
