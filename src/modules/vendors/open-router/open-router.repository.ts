import { Injectable } from '@nestjs/common';
import { OpenRouterClient } from './open-router.client';

@Injectable()
export class OpenRouterRepository {
  constructor(private readonly client: OpenRouterClient) {}

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: { role: 'system' | 'user'; content: string }[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const result = await this.client.instance.chat.completions.create({
      model: this.client.getModel(),
      messages,
    });

    return result.choices[0]?.message?.content ?? '';
  }
}
