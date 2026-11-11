import { Injectable } from '@nestjs/common';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import { LlmMessages } from './constants/llm.messages';
import { LLM_TEMPERATURE } from './constants/llm.constants';
import { LlmClient } from './llm.client';
import { LlmFormat } from './types/llm.enums';
import { LlmError } from './llm.error';
import type { LlmCompletion, LlmJsonSchema, LlmPrompt } from './types/llm.interface';

@Injectable()
export class LlmRepository {
  constructor(private readonly llmClient: LlmClient) {}

  async complete(
    { system, user }: LlmPrompt,
    format: LlmFormat,
    jsonSchema: LlmJsonSchema,
  ): Promise<LlmCompletion> {
    const { instance, model } = this.llmClient;
    if (!instance) {
      throw new LlmError(LlmMessages.DISABLED);
    }
    const completion = await instance.chat.completions.create({
      model,
      temperature: LLM_TEMPERATURE,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      ...this.toResponseFormat(format, jsonSchema),
    });
    return {
      content: completion.choices[0]?.message.content ?? '',
      model: completion.model || model,
    };
  }

  private toResponseFormat(
    format: LlmFormat,
    { name, schema }: LlmJsonSchema,
  ): Pick<ChatCompletionCreateParamsNonStreaming, 'response_format'> {
    switch (format) {
      case LlmFormat.JSON_SCHEMA:
        return { response_format: { type: 'json_schema', json_schema: { name, schema } } };
      case LlmFormat.JSON_OBJECT:
        return { response_format: { type: 'json_object' } };
      case LlmFormat.TEXT:
        return {};
    }
  }
}
