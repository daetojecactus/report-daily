import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppEnvs } from '../config/config.env';
import { REDIS_RETRY_DELAY_MS, REDIS_RETRY_MAX_DELAY_MS } from './constants/redis.constants';
import { RedisMessages } from './constants/redis.messages';

@Injectable()
export class RedisClient implements OnModuleDestroy {
  private readonly logger = new Logger(RedisClient.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService<AppEnvs, true>) {
    this.client = new Redis(this.configService.get('REDIS_URL', { infer: true }), {
      retryStrategy: (times) => Math.min(times * REDIS_RETRY_DELAY_MS, REDIS_RETRY_MAX_DELAY_MS),
    });
    this.client.on('error', (error: Error) =>
      this.logger.error({ error: error.message }, RedisMessages.REDIS_CONNECTION_ERROR),
    );
  }

  get instance(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
