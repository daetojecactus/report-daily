import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from 'src/common/utils/error.util';
import { finishesWithin } from 'src/common/utils/timeout.util';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { SYSTEM_HEALTH_TIMEOUT_MS } from './constants/system.constants';
import { SystemMessages } from './constants/system.messages';
import { DependencyStatus, HealthStatus } from './types/system.enums';
import type { SystemHealth } from './types/system.interface';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  async getHealth(): Promise<SystemHealth> {
    const [database, redis] = await Promise.all([
      this.checkDependency(() => this.databaseService.ping(), SystemMessages.DATABASE_UNAVAILABLE),
      this.checkDependency(() => this.redisService.ping(), SystemMessages.REDIS_UNAVAILABLE),
    ]);
    const isHealthy =
      database === DependencyStatus.CONNECTED && redis === DependencyStatus.CONNECTED;

    return {
      status: isHealthy ? HealthStatus.OK : HealthStatus.DEGRADED,
      database,
      redis,
    };
  }

  private async checkDependency(ping: () => Promise<unknown>, failureMessage: SystemMessages) {
    try {
      if (await finishesWithin(ping(), SYSTEM_HEALTH_TIMEOUT_MS)) {
        return DependencyStatus.CONNECTED;
      }
      this.logger.warn(`${failureMessage}: ${SystemMessages.NO_ANSWER}`);
      return DependencyStatus.DISCONNECTED;
    } catch (error) {
      this.logger.warn(`${failureMessage}: ${getErrorMessage(error)}`);
      return DependencyStatus.DISCONNECTED;
    }
  }
}
