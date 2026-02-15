import { Module } from '@nestjs/common';
import { OpenRouterClient } from './open-router.client';
import { OpenRouterRepository } from './open-router.repository';
import { OpenRouterService } from './open-router.service';

@Module({
  providers: [OpenRouterClient, OpenRouterRepository, OpenRouterService],
  exports: [OpenRouterService],
})
export class OpenRouterModule {}
