import { Injectable } from "@nestjs/common";
import { GeminiClient } from "./gemini.client";
import type { GeminiGenerateContentResponse } from "./gemini.types";

@Injectable()
export class GeminiRepository {
  constructor(private readonly geminiClient: GeminiClient) {}

  async generate(prompt: string): Promise<GeminiGenerateContentResponse> {
    const model = this.geminiClient.instance;
    if (!model) {
      throw new Error("Gemini API not configured");
    }

    const result = await model.generateContent(prompt);
    return {
      text: result.response.text(),
    };
  }

  isEnabled(): boolean {
    return this.geminiClient.isEnabled();
  }
}
