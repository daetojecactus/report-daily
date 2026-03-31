import { Injectable } from '@nestjs/common';
import { GeminiRepository } from './gemini.repository';
import type { AiProvider } from '../../../common/interfaces/ai-provider.interface';

@Injectable()
export class GeminiService implements AiProvider {
  readonly name = 'Gemini';

  constructor(private readonly repository: GeminiRepository) {}

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const text = await this.repository.generate(prompt, systemPrompt);
    return text.trim();
  }
}
