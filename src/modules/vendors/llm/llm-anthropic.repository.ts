import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { OutputConfig } from '@anthropic-ai/sdk/resources/messages';
import { Injectable } from '@nestjs/common';
import { LlmMessages } from './constants/llm.messages';
import { LLM_ANTHROPIC_EFFORT, LLM_ANTHROPIC_THINKING_TOKENS } from './constants/llm.constants';
import { LlmClient } from './llm.client';
import { LlmFormat } from './types/llm.enums';
import { LlmError } from './llm.error';
import type { LlmCompletion, LlmPrompt, LlmSchema } from './types/llm.interface';

@Injectable()
export class LlmAnthropicRepository {
  constructor(private readonly llmClient: LlmClient) {}

  async complete(
    { system, user }: LlmPrompt,
    format: LlmFormat,
    schema: LlmSchema,
    maxTokens: number,
  ): Promise<LlmCompletion> {
    const { anthropic, model } = this.llmClient;
    if (!anthropic) {
      throw new LlmError(LlmMessages.DISABLED);
    }
    const message = await anthropic.messages.create({
      model,
      max_tokens: maxTokens + LLM_ANTHROPIC_THINKING_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: LLM_ANTHROPIC_EFFORT, ...this.toOutputFormat(format, schema) },
    });
    if (message.stop_reason === 'refusal') {
      throw new LlmError(LlmMessages.REFUSED);
    }
    return {
      content: message.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join(''),
      model: message.model || model,
      cut: message.stop_reason === 'max_tokens',
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        thinkingTokens: message.usage.output_tokens_details?.thinking_tokens ?? null,
      },
    };
  }

  private toOutputFormat(format: LlmFormat, { schema }: LlmSchema): Pick<OutputConfig, 'format'> {
    switch (format) {
      case LlmFormat.JSON_SCHEMA: {
        const { type, schema: jsonSchema } = zodOutputFormat(schema);
        return { format: { type, schema: jsonSchema } };
      }
      case LlmFormat.JSON_OBJECT:
      case LlmFormat.TEXT:
        return {};
    }
  }
}
