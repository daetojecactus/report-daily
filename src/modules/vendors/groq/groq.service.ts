import { Injectable } from '@nestjs/common';
import { GroqRepository } from './groq.repository';

@Injectable()
export class GroqService {
  constructor(private readonly groqRepository: GroqRepository) {}

  isEnabled(): boolean {
    return this.groqRepository.isEnabled();
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.groqRepository.generate(prompt);
    return response.text.trim();
  }
}
