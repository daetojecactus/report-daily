import { Injectable } from '@nestjs/common';
import { OpenRouterRepository } from './open-router.repository';
import { BaseAiProvider } from '../../../common/interfaces/ai-provider.interface';

@Injectable()
export class OpenRouterService extends BaseAiProvider {
  readonly name = 'OpenRouter';

  constructor(repository: OpenRouterRepository) {
    super(repository);
  }
}
