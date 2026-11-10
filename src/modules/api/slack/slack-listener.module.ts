import { Module } from '@nestjs/common';
import { InboundQueueModule } from 'src/modules/queue/inbound/inbound-queue.module';
import { SlackModule } from 'src/modules/vendors/slack/slack.module';
import { SlackListener } from './slack.listener';

@Module({
  imports: [SlackModule, InboundQueueModule],
  providers: [SlackListener],
})
export class SlackListenerModule {}
