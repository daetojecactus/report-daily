import { Module } from '@nestjs/common';
import { GitModule } from '../git/git.module';
import { AiModule } from '../ai/ai.module';
import { TelegramModule } from '../../vendors/telegram/telegram.module';
import { GitLabModule } from '../../vendors/gitlab/gitlab.module';
import { ReportService } from './report.service';
import { TaskStatusService } from './task-status.service';
import { FormatterService } from './formatter/formatter.service';
import { GitGroupService } from './git-report/git-group/git-group.service';
import { GitMapperService } from './git-report/git-mapper/git-mapper.service';

@Module({
  imports: [GitModule, AiModule, TelegramModule, GitLabModule],
  providers: [
    ReportService,
    TaskStatusService,
    FormatterService,
    GitGroupService,
    GitMapperService,
  ],
  exports: [ReportService, GitGroupService, GitMapperService],
})
export class ReportModule {}
