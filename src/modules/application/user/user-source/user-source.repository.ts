import { Injectable } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import type { UserSourceInsert } from './types/user-source.interface';
import { userSources } from './user-source.schema';

@Injectable()
export class UserSourceRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  find(filter?: SQL) {
    return this.databaseService.db.select().from(userSources).where(filter);
  }

  async findOne(filter: SQL) {
    const [account] = await this.databaseService.db
      .select()
      .from(userSources)
      .where(filter)
      .limit(1);
    return account ?? null;
  }

  async create(values: UserSourceInsert) {
    const [account] = await this.databaseService.db.insert(userSources).values(values).returning();
    return account;
  }

  async updateOne(filter: SQL, values: Partial<UserSourceInsert>) {
    const [account] = await this.databaseService.db
      .update(userSources)
      .set(values)
      .where(filter)
      .returning();
    return account ?? null;
  }

  async deleteOne(filter: SQL) {
    const [account] = await this.databaseService.db.delete(userSources).where(filter).returning();
    return account ?? null;
  }
}
