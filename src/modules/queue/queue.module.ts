import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ReportDailyBotEnvs } from 'src/modules/config/env';
import { ReportQueueModule } from './report/report-queue.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService<ReportDailyBotEnvs, true>) => ({
        connection: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
    ReportQueueModule,
  ],
  exports: [ReportQueueModule],
})
export class QueueModule {}
