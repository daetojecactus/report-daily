import { Global, Module } from '@nestjs/common';
import { RedisClient } from './redis.client';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisClient, RedisService],
  exports: [RedisClient, RedisService],
})
export class RedisModule {}
