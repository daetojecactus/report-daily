import { Injectable } from '@nestjs/common';
import { OpenRouterRepository } from './open-router.repository';
import type { AiProvider } from '../../../common/interfaces/ai-provider.interface';

@Injectable()
export class OpenRouterService implements AiProvider {
  readonly name = 'OpenRouter';

  constructor(private readonly repository: OpenRouterRepository) {}

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const text = await this.repository.generate(prompt, systemPrompt);
    return text.trim();
  }
}
