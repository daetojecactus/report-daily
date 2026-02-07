import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { GroqModule } from '../../vendors/groq/groq.module';

@Module({
  imports: [GroqModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
