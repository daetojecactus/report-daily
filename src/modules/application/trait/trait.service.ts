import { Injectable } from '@nestjs/common';
import { and, eq, type SQL } from 'drizzle-orm';
import { toSourceKey } from 'src/common/utils/source-name.util';
import type { Source } from 'src/modules/application/source/source.enums';
import type {
  TraitMappingInput,
  TraitMappingInsert,
  TraitMappingUpdate,
  TraitValue,
} from './trait.interface';
import { TraitRepository } from './trait.repository';
import { traitMappings } from './trait.schema';

@Injectable()
export class TraitService {
  constructor(private readonly traitRepository: TraitRepository) {}

  find(filter?: SQL) {
    return this.traitRepository.find(filter);
  }

  findOne(filter: SQL) {
    return this.traitRepository.findOne(filter);
  }

  create(values: TraitMappingInsert) {
    return this.traitRepository.create(values);
  }

  updateOne(filter: SQL, values: TraitMappingUpdate) {
    return this.traitRepository.updateOne(filter, values);
  }

  deleteOne(filter: SQL) {
    return this.traitRepository.deleteOne(filter);
  }

  findById(id: string) {
    return this.findOne(eq(traitMappings.id, id));
  }

  findByKey(source: Source, sourceKey: string) {
    return this.find(this.toKeyFilter(source, sourceKey));
  }

  countSourceNames() {
    return this.traitRepository.countSourceNames();
  }

  findSourceNamePage(limit: number, offset: number) {
    return this.traitRepository.findSourceNamePage(limit, offset);
  }

  changeValue(id: string, value: TraitValue) {
    return this.updateOne(eq(traitMappings.id, id), { value });
  }

  deleteById(id: string) {
    return this.deleteOne(eq(traitMappings.id, id));
  }

  deleteByKey(source: Source, sourceKey: string) {
    return this.traitRepository.deleteMany(this.toKeyFilter(source, sourceKey));
  }

  addValue({ source, sourceName, role, dimension, value }: TraitMappingInput) {
    const name = sourceName.trim();
    return this.traitRepository.createIfMissing({
      source,
      sourceName: name,
      sourceKey: toSourceKey(name),
      role,
      dimension,
      value,
    });
  }

  private toKeyFilter(source: Source, sourceKey: string) {
    return and(
      eq(traitMappings.source, source),
      eq(traitMappings.sourceKey, sourceKey),
    )!;
  }
}
