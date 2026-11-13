import { Module } from '@nestjs/common';
import { AiModule } from 'src/modules/application/ai/ai.module';
import { ReportModule } from 'src/modules/application/report/report.module';
import { SourceModule } from 'src/modules/application/source/source.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { AppConfigModule } from 'src/modules/infrastructure/config/config.module';
import { DatabaseModule } from 'src/modules/infrastructure/database/database.module';
import { RedisModule } from 'src/modules/infrastructure/redis/redis.module';
import { PreviewRenderer } from './preview.renderer';
import { PreviewService } from './preview.service';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    UserModule,
    SourceModule,
    ReportModule,
    AiModule,
  ],
  providers: [PreviewService, PreviewRenderer],
})
export class PreviewModule {}
