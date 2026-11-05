import { Module } from '@nestjs/common';
import { GitLabClient } from './gitlab.client';
import { GitLabRepository } from './gitlab.repository';
import { GitLabService } from './gitlab.service';

@Module({
  providers: [GitLabClient, GitLabRepository, GitLabService],
  exports: [GitLabService],
})
export class GitLabModule {}
