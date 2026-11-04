import { Injectable } from '@nestjs/common';
import { RedisClient } from './redis.client';

@Injectable()
export class RedisService {
  constructor(private readonly redisClient: RedisClient) {}

  ping() {
    return this.redisClient.instance.ping();
  }
}
