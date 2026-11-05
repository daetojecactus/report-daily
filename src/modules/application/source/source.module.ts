import { Module } from '@nestjs/common';
import { GitLabModule } from 'src/modules/vendors/gitlab/gitlab.module';
import { GitLabSourceActions } from './gitlab/gitlab-source.actions';
import { GitLabSourceBuilder } from './gitlab/gitlab-source.builder';
import { GitLabSourceDetails } from './gitlab/gitlab-source.details';
import { GitLabSourceHistory } from './gitlab/gitlab-source.history';
import { GitLabSourceKeys } from './gitlab/gitlab-source.keys';
import { GitLabSourceNotes } from './gitlab/gitlab-source.notes';
import { GitLabSourceScanner } from './gitlab/gitlab-source.scanner';
import { GitLabSourceService } from './gitlab/gitlab-source.service';
import { SourceService } from './source.service';

@Module({
  imports: [GitLabModule],
  providers: [
    SourceService,
    GitLabSourceService,
    GitLabSourceBuilder,
    GitLabSourceScanner,
    GitLabSourceDetails,
    GitLabSourceKeys,
    GitLabSourceHistory,
    GitLabSourceActions,
    GitLabSourceNotes,
  ],
  exports: [SourceService],
})
export class SourceModule {}
