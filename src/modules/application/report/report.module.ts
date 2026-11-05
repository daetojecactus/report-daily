import { Module } from '@nestjs/common';
import { GitLabModule } from 'src/modules/vendors/gitlab/gitlab.module';
import { SourceBuilder } from './source/source.builder';
import { SourceService } from './source/source.service';

@Module({
  imports: [GitLabModule],
  providers: [SourceService, SourceBuilder],
  exports: [SourceService],
})
export class ReportModule {}
