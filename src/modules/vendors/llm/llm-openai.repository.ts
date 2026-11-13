import { Injectable } from '@nestjs/common';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import { z } from 'zod';
import { LlmMessages } from './constants/llm.messages';
import { LLM_TEMPERATURE } from './constants/llm.constants';
import { LlmClient } from './llm.client';
import { LlmFormat } from './types/llm.enums';
import { LlmError } from './llm.error';
import type { LlmCompletion, LlmPrompt, LlmSchema } from './types/llm.interface';

@Injectable()
export class LlmOpenAiRepository {
  constructor(private readonly llmClient: LlmClient) {}

  async complete(
    { system, user }: LlmPrompt,
    format: LlmFormat,
    schema: LlmSchema,
    maxTokens: number,
  ): Promise<LlmCompletion> {
    const { openAi, model } = this.llmClient;
    if (!openAi) {
      throw new LlmError(LlmMessages.DISABLED);
    }
    const completion = await openAi.chat.completions.create({
      model,
      temperature: LLM_TEMPERATURE,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      ...this.toResponseFormat(format, schema),
    });
    const choice = completion.choices[0];
    return {
      content: choice?.message.content ?? '',
      model: completion.model || model,
      cut: choice?.finish_reason === 'length',
      usage: {
        inputTokens: completion.usage?.prompt_tokens ?? null,
        outputTokens: completion.usage?.completion_tokens ?? null,
        thinkingTokens: completion.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      },
    };
  }

  private toResponseFormat(
    format: LlmFormat,
    { name, schema }: LlmSchema,
  ): Pick<ChatCompletionCreateParamsNonStreaming, 'response_format'> {
    switch (format) {
      case LlmFormat.JSON_SCHEMA:
        return {
          response_format: {
            type: 'json_schema',
            json_schema: { name, schema: z.toJSONSchema(schema) },
          },
        };
      case LlmFormat.JSON_OBJECT:
        return { response_format: { type: 'json_object' } };
      case LlmFormat.TEXT:
        return {};
    }
  }
}
