import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class GroqClient {
  private readonly client: Groq | null;
  private readonly model: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    this.model =
      this.configService.get<string>('GROQ_MODEL') || 'llama-3.3-70b-versatile';

    this.enabled = Boolean(apiKey);
    this.client = apiKey ? new Groq({ apiKey }) : null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  get instance(): Groq | null {
    return this.client;
  }

  getModel(): string {
    return this.model;
  }
}
