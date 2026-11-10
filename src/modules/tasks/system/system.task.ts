import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { SystemQueueProducer } from 'src/modules/queue/system/system-queue.producer';

@Injectable()
export class SystemTask implements OnApplicationBootstrap {
  private readonly timeZone: string;

  constructor(
    private readonly systemQueueProducer: SystemQueueProducer,
    configService: ConfigService<AppEnvs, true>,
  ) {
    this.timeZone = configService.get('APP_TIMEZONE', { infer: true });
  }

  async onApplicationBootstrap() {
    await this.systemQueueProducer.scheduleTick();
    await this.systemQueueProducer.scheduleCleanup(this.timeZone);
  }
}
