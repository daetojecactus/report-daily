import { Injectable } from '@nestjs/common';
import { and, eq, type SQL } from 'drizzle-orm';
import type { Channel } from 'src/common/enums/channel.enums';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import { userChannels } from './channel/channel.schema';
import type { UserInsert, UserWithChannel } from './user.interface';
import { users } from './user.schema';

@Injectable()
export class UserRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  find(filter?: SQL) {
    return this.databaseService.db.select().from(users).where(filter);
  }

  async findOne(filter: SQL) {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(filter)
      .limit(1);
    return user ?? null;
  }

  async create(values: UserInsert) {
    const [user] = await this.databaseService.db
      .insert(users)
      .values(values)
      .returning();
    return user;
  }

  async updateOne(filter: SQL, values: Partial<UserInsert>) {
    const [user] = await this.databaseService.db
      .update(users)
      .set(values)
      .where(filter)
      .returning();
    return user ?? null;
  }

  async deleteOne(filter: SQL) {
    const [user] = await this.databaseService.db
      .delete(users)
      .where(filter)
      .returning();
    return user ?? null;
  }

  async findOneByChannel(
    channel: Channel,
    externalId: string,
  ): Promise<UserWithChannel | null> {
    const [row] = await this.databaseService.db
      .select({ user: users, channel: userChannels })
      .from(userChannels)
      .innerJoin(users, eq(users.id, userChannels.userId))
      .where(
        and(
          eq(userChannels.channel, channel),
          eq(userChannels.externalId, externalId),
        ),
      )
      .limit(1);
    return row ?? null;
  }
}
