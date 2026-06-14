import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ReportDailyBotEnvs } from '../../infrastructure/config/env';

@Injectable()
export class OpenRouterClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {
    this.model = this.configService.get('OPENROUTER_MODEL');
    this.client = new OpenAI({
      apiKey: this.configService.get('OPENROUTER_API_KEY'),
      baseURL: this.configService.get('OPENROUTER_API_URL'),
    });
  }

  get instance(): OpenAI {
    return this.client;
  }

  getModel(): string {
    return this.model;
  }
}
