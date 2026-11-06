import { Injectable } from '@nestjs/common';
import { and, eq, type SQL } from 'drizzle-orm';
import type { Source } from 'src/modules/application/source/source.enums';
import type { UserSourceInsert } from './user-source.interface';
import { UserSourceRepository } from './user-source.repository';
import { userSources } from './user-source.schema';

@Injectable()
export class UserSourceService {
  constructor(private readonly userSourceRepository: UserSourceRepository) {}

  find(filter?: SQL) {
    return this.userSourceRepository.find(filter);
  }

  findOne(filter: SQL) {
    return this.userSourceRepository.findOne(filter);
  }

  create(values: UserSourceInsert) {
    return this.userSourceRepository.create(values);
  }

  updateOne(filter: SQL, values: Partial<UserSourceInsert>) {
    return this.userSourceRepository.updateOne(filter, values);
  }

  deleteOne(filter: SQL) {
    return this.userSourceRepository.deleteOne(filter);
  }

  findByUser(userId: string) {
    return this.find(eq(userSources.userId, userId));
  }

  findOneByExternalId(source: Source, externalId: string) {
    return this.findOne(
      and(eq(userSources.source, source), eq(userSources.externalId, externalId))!,
    );
  }

  findOneByUsername(source: Source, username: string) {
    return this.findOne(and(eq(userSources.source, source), eq(userSources.username, username))!);
  }
}
