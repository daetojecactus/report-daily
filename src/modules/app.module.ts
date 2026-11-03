import { Module } from '@nestjs/common';
import { HealthModule } from 'src/modules/api/health/health.module';
import { BullRootModule } from 'src/modules/infrastructure/bull-root/bull-root.module';
import { AppConfigModule } from 'src/modules/infrastructure/config/config.module';
import { DatabaseModule } from 'src/modules/infrastructure/database/database.module';
import { LoggerModule } from 'src/modules/infrastructure/logger/logger.module';
import { RedisModule } from 'src/modules/infrastructure/redis/redis.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    DatabaseModule,
    RedisModule,
    BullRootModule,
    HealthModule,
  ],
})
export class AppModule {}
