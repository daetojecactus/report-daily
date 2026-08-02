import { Injectable } from '@nestjs/common';
import { GeminiRepository } from './gemini.repository';
import { BaseAiProvider } from '../../../common/interfaces/ai-provider.interface';

@Injectable()
export class GeminiService extends BaseAiProvider {
  readonly name = 'Gemini';

  constructor(repository: GeminiRepository) {
    super(repository);
  }
}
