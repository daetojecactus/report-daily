import { Module } from '@nestjs/common';
import { GitModule } from '../git/git.module';
import { AiModule } from '../ai/ai.module';
import { TelegramModule } from '../../vendors/telegram/telegram.module';
import { GitLabModule } from '../../vendors/gitlab/gitlab.module';
import { ReportService } from './report.service';
import { GitGroupService } from './git-report/git-group/git-group.service';
import { GitMapperService } from './git-report/git-mapper/git-mapper.service';
import { GitReportService } from './git-report/git-report.service';

@Module({
  imports: [GitModule, AiModule, TelegramModule, GitLabModule],
  providers: [
    ReportService,
    GitReportService,
    GitGroupService,
    GitMapperService,
  ],
  exports: [ReportService, GitReportService, GitGroupService, GitMapperService],
})
export class ReportModule {}
