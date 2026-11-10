import { Module } from '@nestjs/common';
import { LlmModule } from 'src/modules/vendors/llm/llm.module';
import { AiService } from './ai.service';

@Module({
  imports: [LlmModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
