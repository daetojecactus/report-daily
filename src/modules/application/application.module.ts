import { Module } from '@nestjs/common';
import { ReportModule } from './report/report.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [ReportModule, MailModule],
  exports: [ReportModule, MailModule],
})
export class ApplicationModule {}
