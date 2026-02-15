import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { UserModule } from '../user/user.module';
import { GitLabModule } from '../../vendors/gitlab/gitlab.module';
import { ReportService } from './report.service';
import { GitGroupService } from './git-report/git-group/git-group.service';
import { GitMapperService } from './git-report/git-mapper/git-mapper.service';
import { GitReportService } from './git-report/git-report.service';

@Module({
  imports: [AiModule, UserModule, GitLabModule],
  providers: [
    ReportService,
    GitReportService,
    GitGroupService,
    GitMapperService,
  ],
  exports: [ReportService],
})
export class ReportModule {}
