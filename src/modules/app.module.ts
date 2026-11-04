import { Module } from '@nestjs/common';
import { HealthModule } from 'src/modules/api/health/health.module';
import { TelegramPollerModule } from 'src/modules/api/telegram/telegram-poller.module';
import { BullRootModule } from 'src/modules/infrastructure/bull-root/bull-root.module';
import { AppConfigModule } from 'src/modules/infrastructure/config/config.module';
import { DatabaseModule } from 'src/modules/infrastructure/database/database.module';
import { LoggerModule } from 'src/modules/infrastructure/logger/logger.module';
import { RedisModule } from 'src/modules/infrastructure/redis/redis.module';
import { QueueModule } from 'src/modules/queue/queue.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    DatabaseModule,
    RedisModule,
    BullRootModule,
    QueueModule,
    HealthModule,
    TelegramPollerModule,
  ],
})
export class AppModule {}
