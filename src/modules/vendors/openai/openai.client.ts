import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

@Injectable()
export class OpenAIClient {
  private readonly client: OpenAI | null;
  private readonly model: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");
    this.model =
      this.configService.get<string>("OPENAI_MODEL") || "gpt-4o-mini";

    this.enabled = Boolean(apiKey);

    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    } else {
      this.client = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  get instance(): OpenAI | null {
    return this.client;
  }

  getModel(): string {
    return this.model;
  }
}
