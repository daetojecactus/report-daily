import { Module } from '@nestjs/common';
import { ReportModule } from 'src/modules/application/report/report.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { AppConfigModule } from 'src/modules/infrastructure/config/config.module';
import { DatabaseModule } from 'src/modules/infrastructure/database/database.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, UserModule, ReportModule],
})
export class PreviewModule {}
