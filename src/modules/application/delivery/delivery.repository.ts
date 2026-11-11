import { Injectable } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import type { DeliveryInsert, DeliveryUpdate } from './types/delivery.interface';
import { deliveries } from './delivery.schema';

@Injectable()
export class DeliveryRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  find(filter?: SQL) {
    return this.databaseService.db.select().from(deliveries).where(filter);
  }

  async findOne(filter: SQL) {
    const [delivery] = await this.databaseService.db
      .select()
      .from(deliveries)
      .where(filter)
      .limit(1);
    return delivery ?? null;
  }

  async create(values: DeliveryInsert) {
    const [delivery] = await this.databaseService.db.insert(deliveries).values(values).returning();
    return delivery;
  }

  async deleteMany(filter: SQL) {
    const result = await this.databaseService.db.delete(deliveries).where(filter);
    return result.rowCount ?? 0;
  }

  async updateOne(filter: SQL, values: DeliveryUpdate) {
    const [delivery] = await this.databaseService.db
      .update(deliveries)
      .set(values)
      .where(filter)
      .returning();
    return delivery ?? null;
  }
}
