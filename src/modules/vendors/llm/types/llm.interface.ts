import type { z } from 'zod';
import type { LlmFormat } from './llm.enums';

export interface LlmPrompt {
  system: string;
  user: string;
}

export interface LlmSchema {
  name: string;
  schema: z.ZodType;
}

export interface LlmUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  thinkingTokens: number | null;
}

export interface LlmCompletion {
  content: string;
  model: string;
  cut: boolean;
  usage: LlmUsage;
}

export interface LlmJsonRequest<T> {
  prompt: LlmPrompt;
  name: string;
  schema: z.ZodType<T>;
  maxTokens: number;
}

export interface LlmJsonAnswer<T> {
  data: T;
  model: string;
  format: LlmFormat;
  usage: LlmUsage;
}
