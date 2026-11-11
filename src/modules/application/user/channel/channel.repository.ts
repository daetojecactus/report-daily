import { Injectable } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import type { UserChannelInsert } from './types/channel.interface';
import { userChannels } from './channel.schema';

@Injectable()
export class ChannelRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  find(filter?: SQL) {
    return this.databaseService.db.select().from(userChannels).where(filter);
  }

  async findOne(filter: SQL) {
    const [channel] = await this.databaseService.db
      .select()
      .from(userChannels)
      .where(filter)
      .limit(1);
    return channel ?? null;
  }

  async create(values: UserChannelInsert) {
    const [channel] = await this.databaseService.db.insert(userChannels).values(values).returning();
    return channel;
  }

  async updateOne(filter: SQL, values: Partial<UserChannelInsert>) {
    const [channel] = await this.databaseService.db
      .update(userChannels)
      .set(values)
      .where(filter)
      .returning();
    return channel ?? null;
  }

  async deleteOne(filter: SQL) {
    const [channel] = await this.databaseService.db.delete(userChannels).where(filter).returning();
    return channel ?? null;
  }
}
