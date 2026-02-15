import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ReportDailyBotEnvs } from '../../../config/env';

@Injectable()
export class OpenRouterClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService<ReportDailyBotEnvs, true>,
  ) {
    this.model = this.config.get('OPENROUTER_MODEL');
    this.client = new OpenAI({
      apiKey: this.config.get('OPENROUTER_API_KEY'),
      baseURL: this.config.get('OPENROUTER_API_URL'),
    });
  }

  get instance(): OpenAI {
    return this.client;
  }

  getModel(): string {
    return this.model;
  }
}
