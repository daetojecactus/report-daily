import { Injectable } from '@nestjs/common';
import { GeminiClient } from './gemini.client';

@Injectable()
export class GeminiRepository {
  constructor(private readonly client: GeminiClient) {}

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const model = this.client.instance.getGenerativeModel({
      model: this.client.getModel(),
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}
