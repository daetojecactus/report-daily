import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { UserModule } from '../user/user.module';
import { ReportService } from './report.service';
import { GitGroupFetcher } from './git-report/git-group/git-group.fetcher';
import { GitGroupBuilder } from './git-report/git-group/git-group.builder';
import { GitMapperService } from './git-report/git-mapper/git-mapper.service';
import { GitMapperContextBuilder } from './git-report/git-mapper/git-mapper.context-builder';
import { GitMapperStatusResolver } from './git-report/git-mapper/git-mapper.status';
import { GitReportService } from './git-report/git-report.service';
import { VendorModule } from 'src/modules/vendors/vendor.module';
import { ReportTemplateService } from './report-template/report-template.service';
import { GitGroupService } from './git-report/git-group/git-group.service';
import { ReportDeliveryService } from './report-delivery/report-delivery.service';

@Module({
  imports: [AiModule, UserModule, VendorModule],
  providers: [
    ReportService,
    ReportDeliveryService,
    ReportTemplateService,
    GitReportService,
    GitGroupService,
    GitGroupFetcher,
    GitGroupBuilder,
    GitMapperService,
    GitMapperContextBuilder,
    GitMapperStatusResolver,
  ],
  exports: [ReportService, ReportDeliveryService],
})
export class ReportModule {}
