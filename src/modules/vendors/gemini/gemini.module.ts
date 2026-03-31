import { Module } from '@nestjs/common';
import { GeminiClient } from './gemini.client';
import { GeminiRepository } from './gemini.repository';
import { GeminiService } from './gemini.service';

@Module({
  providers: [GeminiClient, GeminiRepository, GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
