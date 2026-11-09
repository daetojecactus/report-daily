import { Module } from '@nestjs/common';
import { I18nModule } from 'src/modules/application/i18n/i18n.module';
import { ReportModule } from 'src/modules/application/report/report.module';
import { SourceModule } from 'src/modules/application/source/source.module';
import { TraitModule } from 'src/modules/application/trait/trait.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { AppConfigModule } from 'src/modules/infrastructure/config/config.module';
import { DatabaseModule } from 'src/modules/infrastructure/database/database.module';
import { RedisModule } from 'src/modules/infrastructure/redis/redis.module';
import { PreviewAnonymizer } from './preview.anonymizer';
import { PreviewRecorder } from './preview.recorder';
import { PreviewRenderer } from './preview.renderer';
import { PreviewService } from './preview.service';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    UserModule,
    SourceModule,
    TraitModule,
    ReportModule,
    I18nModule,
  ],
  providers: [PreviewService, PreviewRenderer, PreviewRecorder, PreviewAnonymizer],
})
export class PreviewModule {}
