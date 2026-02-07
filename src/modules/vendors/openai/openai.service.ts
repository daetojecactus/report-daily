import { Injectable } from "@nestjs/common";
import { OpenAIRepository } from "./openai.repository";

@Injectable()
export class OpenAIService {
  constructor(private readonly openAIRepository: OpenAIRepository) {}

  isEnabled(): boolean {
    return this.openAIRepository.isEnabled();
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.openAIRepository.generate(prompt);
    return response.text.trim();
  }
}
