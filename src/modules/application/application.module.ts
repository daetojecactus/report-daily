import { Module } from '@nestjs/common';
import { ReportModule } from './report/report.module';
import { MailModule } from './mail/mail.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [ReportModule, MailModule, UserModule],
  exports: [ReportModule, MailModule],
})
export class ApplicationModule {}
