import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import type { ReportDailyBotEnvs } from '../../../config/env';

@Injectable()
export class GroqClient {
  private readonly client: Groq;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService<ReportDailyBotEnvs, true>,
  ) {
    this.model = this.config.get('GROQ_MODEL');
    this.client = new Groq({ apiKey: this.config.get('GROQ_API_KEY') });
  }

  get instance(): Groq {
    return this.client;
  }

  getModel(): string {
    return this.model;
  }
}
