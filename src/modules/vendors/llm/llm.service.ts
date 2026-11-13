import { APIError as AnthropicApiError } from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { APIError as OpenAiApiError } from 'openai';
import type { z } from 'zod';
import { LlmApi } from 'src/modules/infrastructure/config/types/config.enums';
import {
  LLM_FORMAT_REJECTED_STATUSES,
  LLM_FORMATS,
  LLM_JSON_END,
  LLM_JSON_START,
} from './constants/llm.constants';
import { LlmMessages } from './constants/llm.messages';
import { LlmAnthropicRepository } from './llm-anthropic.repository';
import { LlmClient } from './llm.client';
import { LlmFormat } from './types/llm.enums';
import { LlmError } from './llm.error';
import type { LlmJsonAnswer, LlmJsonRequest } from './types/llm.interface';
import { LlmOpenAiRepository } from './llm-openai.repository';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private format = LlmFormat.JSON_SCHEMA;

  constructor(
    private readonly llmOpenAiRepository: LlmOpenAiRepository,
    private readonly llmAnthropicRepository: LlmAnthropicRepository,
    private readonly llmClient: LlmClient,
  ) {}

  isEnabled() {
    return this.llmClient.isEnabled();
  }

  async completeJson<T>({
    prompt,
    name,
    schema,
    maxTokens,
  }: LlmJsonRequest<T>): Promise<LlmJsonAnswer<T>> {
    const repository =
      this.llmClient.api === LlmApi.ANTHROPIC
        ? this.llmAnthropicRepository
        : this.llmOpenAiRepository;
    for (;;) {
      const format = this.format;
      try {
        const { content, model, cut, usage } = await repository.complete(
          prompt,
          format,
          { name, schema },
          maxTokens,
        );
        return { data: this.parse(content, schema, cut), model, format, usage };
      } catch (error) {
        const next = this.findNextFormat(format, error);
        if (!next) {
          throw error;
        }
        this.format = next;
        this.logger.warn({ from: format, to: next }, LlmMessages.FORMAT_STEPPED_DOWN);
      }
    }
  }

  private findNextFormat(format: LlmFormat, error: unknown) {
    const status: unknown =
      error instanceof OpenAiApiError || error instanceof AnthropicApiError
        ? error.status
        : undefined;
    if (typeof status !== 'number' || !LLM_FORMAT_REJECTED_STATUSES.includes(status)) {
      return null;
    }
    return LLM_FORMATS[LLM_FORMATS.indexOf(format) + 1] ?? null;
  }

  private parse<T>(content: string, schema: z.ZodType<T>, cut: boolean): T {
    const json = this.toJson(content);
    const parsed = json === undefined ? null : schema.safeParse(json);
    if (!parsed?.success) {
      throw new LlmError(cut ? LlmMessages.CUT_ANSWER : LlmMessages.INVALID_ANSWER);
    }
    return parsed.data;
  }

  private toJson(content: string): unknown {
    const start = content.indexOf(LLM_JSON_START);
    const end = content.lastIndexOf(LLM_JSON_END);
    if (start === -1 || end < start) {
      return undefined;
    }
    try {
      return JSON.parse(content.slice(start, end + 1)) as unknown;
    } catch {
      return undefined;
    }
  }
}
