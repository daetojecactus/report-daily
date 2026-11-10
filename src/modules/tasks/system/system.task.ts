import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { SystemQueueProducer } from 'src/modules/queue/system/system-queue.producer';

@Injectable()
export class SystemTask implements OnApplicationBootstrap {
  constructor(private readonly systemQueueProducer: SystemQueueProducer) {}

  async onApplicationBootstrap() {
    await this.systemQueueProducer.scheduleTick();
  }
}
