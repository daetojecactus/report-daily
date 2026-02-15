import { Injectable } from '@nestjs/common';
import { GroqRepository } from './groq.repository';
import type { AiProvider } from '../ai-provider.interface';

@Injectable()
export class GroqService implements AiProvider {
  readonly name = 'Groq';

  constructor(private readonly repository: GroqRepository) {}

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const text = await this.repository.generate(prompt, systemPrompt);
    return text.trim();
  }
}
