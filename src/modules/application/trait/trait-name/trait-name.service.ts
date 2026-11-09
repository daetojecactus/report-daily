import { Injectable } from '@nestjs/common';
import { and, eq, gte, type SQL } from 'drizzle-orm';
import { isValidSourceKey, toSourceKey } from 'src/common/utils/source-name.util';
import type { Source } from 'src/modules/application/source/source.enums';
import {
  TRAIT_DAY_MS,
  TRAIT_NAME_SEEN_DAYS,
  TRAIT_SOURCE_NAME_MAX_LENGTH,
} from '../constants/trait.constants';
import type { TraitNameInsert, TraitNameUpdate } from './trait-name.interface';
import { TraitNameRepository } from './trait-name.repository';
import { traitNames } from './trait-name.schema';

@Injectable()
export class TraitNameService {
  constructor(private readonly traitNameRepository: TraitNameRepository) {}

  find(filter?: SQL) {
    return this.traitNameRepository.find(filter);
  }

  findOne(filter: SQL) {
    return this.traitNameRepository.findOne(filter);
  }

  updateOne(filter: SQL, values: TraitNameUpdate) {
    return this.traitNameRepository.updateOne(filter, values);
  }

  findById(id: string) {
    return this.findOne(eq(traitNames.id, id));
  }

  async record(source: Source, names: string[]) {
    const values = new Map<string, TraitNameInsert>();
    for (const name of names) {
      const sourceName = name.trim();
      const sourceKey = toSourceKey(sourceName);
      if (
        sourceName.length <= TRAIT_SOURCE_NAME_MAX_LENGTH &&
        isValidSourceKey(sourceKey) &&
        !values.has(sourceKey)
      ) {
        values.set(sourceKey, { source, sourceName, sourceKey });
      }
    }
    if (values.size > 0) {
      await this.traitNameRepository.markSeen([...values.values()]);
    }
  }

  countUnmapped(source: Source, ignored: boolean) {
    return this.traitNameRepository.countUnmapped(this.toListFilter(source, ignored));
  }

  findUnmappedPage(source: Source, ignored: boolean, limit: number, offset: number) {
    return this.traitNameRepository.findUnmappedPage(
      this.toListFilter(source, ignored),
      limit,
      offset,
    );
  }

  setIgnored(id: string, ignored: boolean) {
    return this.updateOne(eq(traitNames.id, id), { ignored });
  }

  async findIgnoredKeys(source: Source) {
    const names = await this.traitNameRepository.findUnmapped(this.toListFilter(source, true));
    return new Set(names.map((name) => name.sourceKey));
  }

  private toListFilter(source: Source, ignored: boolean) {
    return and(
      eq(traitNames.source, source),
      eq(traitNames.ignored, ignored),
      ignored
        ? undefined
        : gte(traitNames.seenAt, new Date(Date.now() - TRAIT_NAME_SEEN_DAYS * TRAIT_DAY_MS)),
    )!;
  }
}
