import { Injectable } from "@nestjs/common";
import { GeminiRepository } from "./gemini.repository";

@Injectable()
export class GeminiService {
  constructor(private readonly geminiRepository: GeminiRepository) {}

  isEnabled(): boolean {
    return this.geminiRepository.isEnabled();
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.geminiRepository.generate(prompt);
    return response.text.trim();
  }
}
