import { Module } from '@nestjs/common';
import { LlmClient } from './llm.client';
import { LlmRepository } from './llm.repository';
import { LlmService } from './llm.service';

@Module({
  providers: [LlmClient, LlmRepository, LlmService],
  exports: [LlmService],
})
export class LlmModule {}
