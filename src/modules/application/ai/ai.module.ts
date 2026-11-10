import { Module } from '@nestjs/common';
import { SettingsModule } from 'src/modules/application/settings/settings.module';
import { LlmModule } from 'src/modules/vendors/llm/llm.module';
import { AiService } from './ai.service';

@Module({
  imports: [LlmModule, SettingsModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
