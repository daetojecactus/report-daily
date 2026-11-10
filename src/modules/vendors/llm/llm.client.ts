import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { LLM_MAX_RETRIES, LLM_TIMEOUT_MS } from './constants/llm.constants';

@Injectable()
export class LlmClient {
  readonly instance: OpenAI | null;
  readonly model: string;

  constructor(configService: ConfigService<AppEnvs, true>) {
    const baseURL = configService.get('LLM_BASE_URL', { infer: true });
    const apiKey = configService.get('LLM_TOKEN', { infer: true });
    this.model = configService.get('LLM_MODEL', { infer: true }) ?? '';
    this.instance =
      baseURL && apiKey && this.model
        ? new OpenAI({ baseURL, apiKey, timeout: LLM_TIMEOUT_MS, maxRetries: LLM_MAX_RETRIES })
        : null;
  }
}
