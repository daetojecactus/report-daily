import { Module } from '@nestjs/common';
import { BotModule } from 'src/modules/application/bot/bot.module';
import { InboundQueueModule } from './inbound/inbound-queue.module';
import { InboundQueueProcessor } from './inbound/inbound-queue.processor';

@Module({
  imports: [InboundQueueModule, BotModule],
  providers: [InboundQueueProcessor],
})
export class QueueModule {}
