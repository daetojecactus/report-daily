import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

@Injectable()
export class GeminiClient {
  private readonly model: GenerativeModel | null;
  private readonly enabled: boolean;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const apiKey = config.get<string>("GEMINI_API_KEY");
    const modelName = config.get<string>("GEMINI_MODEL") || "gemini-2.5-flash";

    this.enabled = Boolean(apiKey);

    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({ model: modelName });
    } else {
      this.model = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  get instance(): GenerativeModel | null {
    return this.model;
  }
}
