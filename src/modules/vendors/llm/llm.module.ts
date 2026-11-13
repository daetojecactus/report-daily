import { Module } from '@nestjs/common';
import { LlmAnthropicRepository } from './llm-anthropic.repository';
import { LlmClient } from './llm.client';
import { LlmOpenAiRepository } from './llm-openai.repository';
import { LlmService } from './llm.service';

@Module({
  providers: [LlmClient, LlmOpenAiRepository, LlmAnthropicRepository, LlmService],
  exports: [LlmService],
})
export class LlmModule {}
