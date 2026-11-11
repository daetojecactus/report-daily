import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { getErrorMessage } from 'src/common/utils/error.util';
import { InboundQueueProducer } from 'src/modules/queue/inbound/inbound-queue.producer';
import type { SlackEnvelope } from 'src/modules/vendors/slack/types/slack.interface';
import { SlackService } from 'src/modules/vendors/slack/slack.service';
import { SlackSocket } from 'src/modules/vendors/slack/slack.socket';
import { SlackListenerMessages } from './constants/slack-listener.messages';

@Injectable()
export class SlackListener implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SlackListener.name);

  constructor(
    private readonly slackSocket: SlackSocket,
    private readonly slackService: SlackService,
    private readonly inboundQueueProducer: InboundQueueProducer,
  ) {}

  onApplicationBootstrap() {
    if (!this.slackSocket.isEnabled() || !this.slackService.isEnabled()) {
      return;
    }
    this.slackSocket
      .listen((envelope) => this.receive(envelope))
      .catch((error: unknown) => {
        this.logger.error({ error: getErrorMessage(error) }, SlackListenerMessages.CONNECT_FAILED);
      });
  }

  async onModuleDestroy() {
    await this.slackSocket.close();
  }

  async receive({ type, body, envelopeId, ack }: SlackEnvelope) {
    try {
      const event = this.slackService.toChatEvent(type, body);
      if (event) {
        await this.inboundQueueProducer.addSlackEvent(
          this.slackService.findEventId(body) ?? envelopeId,
          event,
        );
      }
      await ack();
    } catch (error) {
      this.logger.warn(
        { envelopeId, error: getErrorMessage(error) },
        SlackListenerMessages.EVENT_FAILED,
      );
    }
  }
}
