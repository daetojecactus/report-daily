import { Module } from '@nestjs/common';
import { GitModule } from '../git/git.module';
import { AiModule } from '../ai/ai.module';
import { TelegramModule } from '../../vendors/telegram/telegram.module';
import { ReportService } from './report.service';
import { TaskStatusService } from './task-status.service';
import { FormatterService } from './formatter/formatter.service';

@Module({
  imports: [GitModule, AiModule, TelegramModule],
  providers: [ReportService, TaskStatusService, FormatterService],
  exports: [ReportService],
})
export class ReportModule {}
