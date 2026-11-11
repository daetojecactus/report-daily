import { Injectable } from '@nestjs/common';
import { and, eq, isNull, or, type SQL } from 'drizzle-orm';
import { toSourceKey } from 'src/common/utils/source-name.util';
import type { Source } from 'src/modules/application/source/types/source.enums';
import type { JobRole } from 'src/modules/application/user/types/user.enums';
import { TRAIT_DICTIONARY } from './constants/trait.constants';
import { TraitDimension } from './types/trait.enums';
import type {
  TaskTraits,
  TraitDimensionValueMap,
  TraitIndex,
  TraitMappingInput,
  TraitMappingInsert,
  TraitMappingUpdate,
  TraitPair,
  TraitValue,
} from './types/trait.interface';
import { TraitRepository } from './trait.repository';
import { traitMappings } from './trait.schema';
import { TraitNameService } from './trait-name/trait-name.service';

@Injectable()
export class TraitService {
  constructor(
    private readonly traitRepository: TraitRepository,
    private readonly traitNameService: TraitNameService,
  ) {}

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
    const [mappings, ignored] = await Promise.all([
      this.find(
        and(
          eq(traitMappings.source, source),
          or(isNull(traitMappings.role), eq(traitMappings.role, role)),
        ),
      ),
      this.traitNameService.findIgnoredKeys(source),
    ]);
    const pairs = new Map<string, TraitPair[]>();
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
        const values = pairs.get(mapping.sourceKey) ?? [];
        values.push({ dimension: mapping.dimension, value: mapping.value });
        pairs.set(mapping.sourceKey, values);
      }
    }
    return { pairs, ignored };
  }

  findTraits(index: TraitIndex, sourceName: string): TraitPair[] {
    return index.pairs.get(toSourceKey(sourceName)) ?? [];
  }

  isIgnored(index: TraitIndex, sourceName: string) {
    return index.ignored.has(toSourceKey(sourceName));
  }

  findValues<Dimension extends TraitDimension>(
    index: TraitIndex,
    sourceName: string,
    dimension: Dimension,
  ): TraitDimensionValueMap[Dimension][] {
    return this.collect(this.findTraits(index, sourceName), dimension);
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
