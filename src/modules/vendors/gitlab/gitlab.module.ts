import { Module } from '@nestjs/common';
import { GitLabClient } from './gitlab.client';
import { GitLabService } from './gitlab.service';

@Module({
  providers: [GitLabClient, GitLabService],
  exports: [GitLabService],
})
export class GitLabModule {}
