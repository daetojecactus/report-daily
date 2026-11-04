import { Injectable } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import type { UserChannelInsert } from './channel.interface';
import { userChannels } from './channel.schema';

@Injectable()
export class ChannelRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async updateOne(filter: SQL, values: Partial<UserChannelInsert>) {
    const [channel] = await this.databaseService.db
      .update(userChannels)
      .set(values)
      .where(filter)
      .returning();
    return channel ?? null;
  }
}
