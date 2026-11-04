import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/modules/infrastructure/database/database.service';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { SystemMessages } from './constants/system.messages';
import { DependencyStatus, HealthStatus } from './system.enums';
import type { SystemHealth } from './system.interface';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  async getHealth(): Promise<SystemHealth> {
    const [database, redis] = await Promise.all([
      this.checkDependency(
        () => this.databaseService.ping(),
        SystemMessages.DATABASE_UNAVAILABLE,
      ),
      this.checkDependency(
        () => this.redisService.ping(),
        SystemMessages.REDIS_UNAVAILABLE,
      ),
    ]);
    const isHealthy =
      database === DependencyStatus.CONNECTED &&
      redis === DependencyStatus.CONNECTED;

    return {
      status: isHealthy ? HealthStatus.OK : HealthStatus.DEGRADED,
      database,
      redis,
    };
  }

  private async checkDependency(
    ping: () => Promise<unknown>,
    failureMessage: SystemMessages,
  ) {
    try {
      await ping();
      return DependencyStatus.CONNECTED;
    } catch (error) {
      this.logger.warn(
        `${failureMessage}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return DependencyStatus.DISCONNECTED;
    }
  }
}
