import { Module } from '@nestjs/common';
import { SlackClient } from './slack.client';
import { SlackFormatter } from './slack.formatter';
import { SlackRenderer } from './slack.renderer';
import { SlackRepository } from './slack.repository';
import { SlackService } from './slack.service';
import { SlackSocket } from './slack.socket';

@Module({
  providers: [
    SlackClient,
    SlackRepository,
    SlackFormatter,
    SlackRenderer,
    SlackService,
    SlackSocket,
  ],
  exports: [SlackService, SlackSocket],
})
export class SlackModule {}
