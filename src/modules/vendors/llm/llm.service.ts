import { Injectable, Logger } from '@nestjs/common';
import { APIError } from 'openai';
import { z } from 'zod';
import {
  LLM_FORMAT_REJECTED_STATUSES,
  LLM_FORMATS,
  LLM_JSON_END,
  LLM_JSON_START,
} from './constants/llm.constants';
import { LlmMessages } from './constants/llm.messages';
import { LlmClient } from './llm.client';
import { LlmFormat } from './types/llm.enums';
import { LlmError } from './llm.error';
import type { LlmJsonAnswer, LlmJsonRequest } from './types/llm.interface';
import { LlmRepository } from './llm.repository';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private format = LlmFormat.JSON_SCHEMA;

  constructor(
    private readonly llmRepository: LlmRepository,
    private readonly llmClient: LlmClient,
  ) {}

  isEnabled() {
    return this.llmClient.instance !== null;
  }

  async completeJson<T>({
    prompt,
    name,
    schema,
    maxTokens,
  }: LlmJsonRequest<T>): Promise<LlmJsonAnswer<T>> {
    const jsonSchema = { name, schema: z.toJSONSchema(schema) };
    for (;;) {
      const format = this.format;
      try {
        const { content, model, outputTokens } = await this.llmRepository.complete(
          prompt,
          format,
          jsonSchema,
          maxTokens,
        );
        return { data: this.parse(content, schema), model, format, outputTokens };
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
    const status: unknown = error instanceof APIError ? error.status : undefined;
    if (typeof status !== 'number' || !LLM_FORMAT_REJECTED_STATUSES.includes(status)) {
      return null;
    }
    return LLM_FORMATS[LLM_FORMATS.indexOf(format) + 1] ?? null;
  }

  private parse<T>(content: string, schema: z.ZodType<T>): T {
    const start = content.indexOf(LLM_JSON_START);
    const end = content.lastIndexOf(LLM_JSON_END);
    if (start === -1 || end < start) {
      throw new LlmError(LlmMessages.INVALID_ANSWER);
    }
    let json: unknown;
    try {
      json = JSON.parse(content.slice(start, end + 1));
    } catch {
      throw new LlmError(LlmMessages.INVALID_ANSWER);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new LlmError(LlmMessages.INVALID_ANSWER);
    }
    return parsed.data;
  }
}
