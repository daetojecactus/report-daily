import { Injectable } from '@nestjs/common';
import { eq, type SQL } from 'drizzle-orm';
import { toLabelKey } from 'src/common/utils/label.util';
import type {
  LabelMappingInput,
  LabelMappingInsert,
  LabelMappingUpdate,
} from './label.interface';
import { LabelRepository } from './label.repository';
import { labelMappings } from './label.schema';

@Injectable()
export class LabelService {
  constructor(private readonly labelRepository: LabelRepository) {}

  find(filter?: SQL) {
    return this.labelRepository.find(filter);
  }

  findOne(filter: SQL) {
    return this.labelRepository.findOne(filter);
  }

  create(values: LabelMappingInsert) {
    return this.labelRepository.create(values);
  }

  updateOne(filter: SQL, values: LabelMappingUpdate) {
    return this.labelRepository.updateOne(filter, values);
  }

  deleteOne(filter: SQL) {
    return this.labelRepository.deleteOne(filter);
  }

  findById(id: string) {
    return this.findOne(eq(labelMappings.id, id));
  }

  findByKey(labelKey: string) {
    return this.find(eq(labelMappings.labelKey, labelKey));
  }

  countLabels() {
    return this.labelRepository.countLabels();
  }

  findLabelPage(limit: number, offset: number) {
    return this.labelRepository.findLabelPage(limit, offset);
  }

  addValue({ label, role, dimension, value }: LabelMappingInput) {
    const text = label.trim();
    return this.labelRepository.createIfMissing({
      label: text,
      labelKey: toLabelKey(text),
      role,
      dimension,
      value,
    });
  }
}
