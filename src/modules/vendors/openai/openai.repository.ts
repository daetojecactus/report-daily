import { Injectable } from "@nestjs/common";
import { OpenAIClient } from "./openai.client";
import type { OpenAIGenerateContentResponse } from "./openai.types";

@Injectable()
export class OpenAIRepository {
  constructor(private readonly openAIClient: OpenAIClient) {}

  async generate(prompt: string): Promise<OpenAIGenerateContentResponse> {
    const client = this.openAIClient.instance;
    if (!client) {
      throw new Error("OpenAI API not configured");
    }

    const result = await client.chat.completions.create({
      model: this.openAIClient.getModel(),
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.choices[0]?.message?.content ?? "";
    return { text };
  }

  isEnabled(): boolean {
    return this.openAIClient.isEnabled();
  }
}
