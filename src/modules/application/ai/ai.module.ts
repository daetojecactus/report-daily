import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { OpenRouterModule } from '../../vendors/open-router/open-router.module';
import { GroqModule } from '../../vendors/groq/groq.module';

@Module({
  imports: [OpenRouterModule, GroqModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
