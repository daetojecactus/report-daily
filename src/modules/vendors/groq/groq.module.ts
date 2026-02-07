import { Module } from '@nestjs/common';
import { GroqClient } from './groq.client';
import { GroqRepository } from './groq.repository';
import { GroqService } from './groq.service';

@Module({
  providers: [GroqClient, GroqRepository, GroqService],
  exports: [GroqService],
})
export class GroqModule {}
