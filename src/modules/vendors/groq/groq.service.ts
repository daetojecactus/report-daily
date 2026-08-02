import { Injectable } from '@nestjs/common';
import { GroqRepository } from './groq.repository';
import { BaseAiProvider } from '../../../common/interfaces/ai-provider.interface';

@Injectable()
export class GroqService extends BaseAiProvider {
  readonly name = 'Groq';

  constructor(repository: GroqRepository) {
    super(repository);
  }
}
