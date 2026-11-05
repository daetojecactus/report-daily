import { Injectable } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import type { LabelMappingInsert, LabelMappingUpdate } from './label.interface';
import { LabelRepository } from './label.repository';

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
}
