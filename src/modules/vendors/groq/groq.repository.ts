import { Injectable } from '@nestjs/common';
import { GroqClient } from './groq.client';
import type { GroqGenerateContentResponse } from './groq.types';

@Injectable()
export class GroqRepository {
  constructor(private readonly groqClient: GroqClient) {}

  async generate(prompt: string): Promise<GroqGenerateContentResponse> {
    const client = this.groqClient.instance;
    if (!client) {
      throw new Error('Groq API not configured');
    }

    const result = await client.chat.completions.create({
      model: this.groqClient.getModel(),
      messages: [{ role: 'user', content: prompt }],
    });

    const text = result.choices[0]?.message?.content ?? '';
    return { text };
  }

  isEnabled(): boolean {
    return this.groqClient.isEnabled();
  }
}
