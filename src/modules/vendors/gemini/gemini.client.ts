import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ReportDailyBotEnvs } from '../../infrastructure/config/env';

@Injectable()
export class GeminiClient {
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService<ReportDailyBotEnvs, true>,
  ) {
    this.model = this.configService.get('GEMINI_MODEL');
    this.client = new GoogleGenerativeAI(
      this.configService.get('GEMINI_API_KEY'),
    );
  }

  get instance(): GoogleGenerativeAI {
    return this.client;
  }

  getModel(): string {
    return this.model;
  }
}
