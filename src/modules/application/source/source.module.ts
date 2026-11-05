import { Module } from '@nestjs/common';
import { GitLabModule } from 'src/modules/vendors/gitlab/gitlab.module';
import { GitLabSourceBuilder } from './gitlab/gitlab-source.builder';
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
  ],
  exports: [SourceService],
})
export class SourceModule {}
