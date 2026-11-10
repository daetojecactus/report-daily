import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SYSTEM_QUEUE } from './constants/system-queue.constants';
import { SystemQueueProducer } from './system-queue.producer';

@Module({
  imports: [BullModule.registerQueue({ name: SYSTEM_QUEUE })],
  providers: [SystemQueueProducer],
  exports: [SystemQueueProducer],
})
export class SystemQueueModule {}
