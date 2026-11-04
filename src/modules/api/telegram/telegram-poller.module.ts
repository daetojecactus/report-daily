import { Module } from '@nestjs/common';
import { InboundQueueModule } from 'src/modules/queue/inbound/inbound-queue.module';
import { TelegramModule } from 'src/modules/vendors/telegram/telegram.module';
import { TelegramPoller } from './telegram.poller';

@Module({
  imports: [TelegramModule, InboundQueueModule],
  providers: [TelegramPoller],
})
export class TelegramPollerModule {}
