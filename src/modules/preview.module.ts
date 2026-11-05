import { Module } from '@nestjs/common';
import { SourceModule } from 'src/modules/application/source/source.module';
import { UserModule } from 'src/modules/application/user/user.module';
import { AppConfigModule } from 'src/modules/infrastructure/config/config.module';
import { DatabaseModule } from 'src/modules/infrastructure/database/database.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, UserModule, SourceModule],
})
export class PreviewModule {}
