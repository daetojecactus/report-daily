import { Module } from '@nestjs/common';
import { GitLabModule } from '../../vendors/gitlab/gitlab.module';
import { GitService } from './git.service';

@Module({
  imports: [GitLabModule],
  providers: [GitService],
  exports: [GitService],
})
export class GitModule {}
