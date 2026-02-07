import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GitLabClient } from './gitlab.client';
import { GitLabRepository } from './gitlab.repository';
import { GitLabService } from './gitlab.service';

@Module({
  imports: [ConfigModule],
  providers: [GitLabClient, GitLabRepository, GitLabService],
  exports: [GitLabService],
})
export class GitLabModule {}
