import type { LlmUsage } from './types/llm.interface';

export class LlmError extends Error {
  override readonly name = 'LlmError';

  constructor(
    message: string,
    readonly usage: LlmUsage | null = null,
  ) {
    super(message);
  }
}
