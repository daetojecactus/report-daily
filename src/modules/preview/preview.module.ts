import { Module } from '@nestjs/common';
import { SourceModule } from 'src/modules/application/source/source.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { AppConfigModule } from 'src/modules/infrastructure/config/config.module';
import { DatabaseModule } from 'src/modules/infrastructure/database/database.module';
import { RedisModule } from 'src/modules/infrastructure/redis/redis.module';
import { PreviewService } from './preview.service';

@Module({
  imports: [AppConfigModule, DatabaseModule, RedisModule, UserModule, SourceModule],
  providers: [PreviewService],
})
export class PreviewModule {}
