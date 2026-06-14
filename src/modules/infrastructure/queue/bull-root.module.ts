import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ReportDailyBotEnvs } from '../config/env';

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
  ],
  exports: [BullModule],
})
export class BullRootModule {}
