import { Injectable } from '@nestjs/common';
import { and, eq, isNull, or, type SQL } from 'drizzle-orm';
import { toSourceKey } from 'src/common/utils/source-name.util';
import type { Source } from 'src/modules/application/source/source.enums';
import type { JobRole } from 'src/modules/application/user/user.enums';
import { TRAIT_DICTIONARY } from './constants/trait.constants';
import { TraitDimension } from './trait.enums';
import type {
  TaskTraits,
  TraitDimensionValueMap,
  TraitIndex,
  TraitMappingInput,
  TraitMappingInsert,
  TraitMappingUpdate,
  TraitPair,
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

  async loadIndex(source: Source, role: JobRole): Promise<TraitIndex> {
    const mappings = await this.find(
      and(
        eq(traitMappings.source, source),
        or(isNull(traitMappings.role), eq(traitMappings.role, role)),
      ),
    );
    const index: TraitIndex = new Map();
    for (const mapping of mappings) {
      const overridden =
        mapping.role === null &&
        mappings.some(
          (item) =>
            item.role === role &&
            item.sourceKey === mapping.sourceKey &&
            item.dimension === mapping.dimension,
        );
      if (!overridden) {
        const pairs = index.get(mapping.sourceKey) ?? [];
        pairs.push({ dimension: mapping.dimension, value: mapping.value });
        index.set(mapping.sourceKey, pairs);
      }
    }
    return index;
  }

  findTraits(index: TraitIndex, sourceName: string): TraitPair[] {
    return index.get(toSourceKey(sourceName)) ?? [];
  }

  toTaskTraits(index: TraitIndex, sourceNames: string[]): TaskTraits {
    const pairs = sourceNames.flatMap((sourceName) => this.findTraits(index, sourceName));
    return {
      workflowStates: this.collect(pairs, TraitDimension.WORKFLOW_STATE),
      kinds: this.collect(pairs, TraitDimension.TASK_KIND),
      priority: this.collect(pairs, TraitDimension.PRIORITY)[0] ?? null,
      severity: this.collect(pairs, TraitDimension.SEVERITY)[0] ?? null,
      areas: this.collect(pairs, TraitDimension.AREA),
      flags: this.collect(pairs, TraitDimension.FLAG),
    };
  }

  private collect<Dimension extends TraitDimension>(
    pairs: TraitPair[],
    dimension: Dimension,
  ): TraitDimensionValueMap[Dimension][] {
    const values = new Set<TraitValue>(
      pairs.filter((pair) => pair.dimension === dimension).map((pair) => pair.value),
    );
    return TRAIT_DICTIONARY[dimension].filter((value) => values.has(value));
  }

  private toKeyFilter(source: Source, sourceKey: string) {
    return and(eq(traitMappings.source, source), eq(traitMappings.sourceKey, sourceKey))!;
  }
}
