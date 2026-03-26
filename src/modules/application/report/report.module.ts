import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { UserModule } from '../user/user.module';
import { ReportService } from './report.service';
import { GitGroupService } from './git-report/git-group/git-group.service';
import { GitMapperService } from './git-report/git-mapper/git-mapper.service';
import { GitReportService } from './git-report/git-report.service';
import { VendorModule } from 'src/modules/vendors/vendor.module';
import { ReportTemplateService } from './report-template/report-template.service';

@Module({
  imports: [AiModule, UserModule, VendorModule],
  providers: [
    ReportService,
    ReportTemplateService,
    GitReportService,
    GitGroupService,
    GitMapperService,
  ],
  exports: [ReportService],
})
export class ReportModule {}
