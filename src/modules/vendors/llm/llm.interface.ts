import type { z } from 'zod';
import type { LlmFormat } from './llm.enums';

export interface LlmPrompt {
  system: string;
  user: string;
}

export interface LlmJsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

export interface LlmCompletion {
  content: string;
  model: string;
}

export interface LlmJsonRequest<T> {
  prompt: LlmPrompt;
  name: string;
  schema: z.ZodType<T>;
}

export interface LlmJsonAnswer<T> {
  data: T;
  model: string;
  format: LlmFormat;
}
