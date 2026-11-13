import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { LlmApi } from 'src/modules/infrastructure/config/types/config.enums';
import { LLM_MAX_RETRIES, LLM_TIMEOUT_MS } from './constants/llm.constants';

@Injectable()
export class LlmClient {
  readonly api: LlmApi;
  readonly model: string;
  readonly openAi: OpenAI | null = null;
  readonly anthropic: Anthropic | null = null;

  constructor(configService: ConfigService<AppEnvs, true>) {
    const baseURL = configService.get('LLM_BASE_URL', { infer: true });
    const apiKey = configService.get('LLM_TOKEN', { infer: true });
    this.api = configService.get('LLM_API', { infer: true });
    this.model = configService.get('LLM_MODEL', { infer: true }) ?? '';
    if (!baseURL || !apiKey || !this.model) {
      return;
    }
    const options = { baseURL, apiKey, timeout: LLM_TIMEOUT_MS, maxRetries: LLM_MAX_RETRIES };
    switch (this.api) {
      case LlmApi.OPENAI:
        this.openAi = new OpenAI(options);
        break;
      case LlmApi.ANTHROPIC:
        this.anthropic = new Anthropic(options);
        break;
    }
  }

  isEnabled() {
    return this.openAi !== null || this.anthropic !== null;
  }
}
