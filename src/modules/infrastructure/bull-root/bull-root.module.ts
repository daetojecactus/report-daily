import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvs } from '../config/config.env';
import { QUEUE_DEFAULT_JOB_OPTIONS, QUEUE_KEY_PREFIX } from './constants/bull-root.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvs, true>) => {
        const url: string = configService.get('REDIS_URL', { infer: true });
        return {
          connection: { url },
          prefix: QUEUE_KEY_PREFIX,
          defaultJobOptions: QUEUE_DEFAULT_JOB_OPTIONS,
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class BullRootModule {}
