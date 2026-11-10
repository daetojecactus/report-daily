import { Injectable } from '@nestjs/common';
import { and, asc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import type { Channel } from 'src/common/enums/channel.enums';
import type { Source } from 'src/modules/application/source/source.enums';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import { userChannels } from './channel/channel.schema';
import { userSources } from './user-source/user-source.schema';
import type { UserInsert, UserUpdate, UserWithChannel } from './user.interface';
import { users } from './user.schema';

@Injectable()
export class UserRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  find(filter?: SQL) {
    return this.databaseService.db.select().from(users).where(filter);
  }

  async findOne(filter: SQL) {
    const [user] = await this.databaseService.db.select().from(users).where(filter).limit(1);
    return user ?? null;
  }

  async create(values: UserInsert) {
    const [user] = await this.databaseService.db.insert(users).values(values).returning();
    return user;
  }

  async updateOne(filter: SQL, values: UserUpdate) {
    const [user] = await this.databaseService.db
      .update(users)
      .set(values)
      .where(filter)
      .returning();
    return user ?? null;
  }

  async deleteOne(filter: SQL) {
    const [user] = await this.databaseService.db.delete(users).where(filter).returning();
    return user ?? null;
  }

  findPage(filter: SQL | undefined, limit: number, offset: number) {
    return this.databaseService.db
      .select()
      .from(users)
      .where(filter)
      .orderBy(asc(users.displayName), asc(users.id))
      .limit(limit)
      .offset(offset);
  }

  search(pattern: string, limit: number) {
    const accounts = this.databaseService.db
      .select({ userId: userSources.userId })
      .from(userSources)
      .where(ilike(userSources.username, pattern));
    return this.findPage(
      or(ilike(users.displayName, pattern), inArray(users.id, accounts)),
      limit,
      0,
    );
  }

  count(filter?: SQL) {
    return this.databaseService.db.$count(users, filter);
  }

  async findOneByChannel(channel: Channel, externalId: string): Promise<UserWithChannel | null> {
    const [row] = await this.databaseService.db
      .select({ user: users, channel: userChannels })
      .from(userChannels)
      .innerJoin(users, eq(users.id, userChannels.userId))
      .where(and(eq(userChannels.channel, channel), eq(userChannels.externalId, externalId)))
      .limit(1);
    return row ?? null;
  }

  async findOneBySource(source: Source, externalId: string) {
    const [row] = await this.databaseService.db
      .select({ user: users })
      .from(userSources)
      .innerJoin(users, eq(users.id, userSources.userId))
      .where(and(eq(userSources.source, source), eq(userSources.externalId, externalId)))
      .limit(1);
    return row?.user ?? null;
  }

  async findReachable(channel: Channel, filter?: SQL) {
    const rows = await this.databaseService.db
      .select({ user: users })
      .from(users)
      .innerJoin(
        userChannels,
        and(
          eq(userChannels.userId, users.id),
          eq(userChannels.channel, channel),
          eq(userChannels.reachable, true),
        ),
      )
      .where(filter);
    return rows.map(({ user }) => user);
  }
}
