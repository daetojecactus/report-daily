import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogLevel, SocketModeClient } from '@slack/socket-mode';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { SLACK_SOCKET_EVENT } from './constants/slack.constants';
import type { SlackEnvelope } from './types/slack.interface';

@Injectable()
export class SlackSocket {
  private readonly client: SocketModeClient | null;

  constructor(configService: ConfigService<AppEnvs, true>) {
    const appToken = configService.get('SLACK_APP_TOKEN', { infer: true });
    this.client = appToken ? new SocketModeClient({ appToken, logLevel: LogLevel.ERROR }) : null;
  }

  isEnabled() {
    return this.client !== null;
  }

  async listen(handle: (envelope: SlackEnvelope) => Promise<void>) {
    if (!this.client) {
      return;
    }
    this.client.on(
      SLACK_SOCKET_EVENT,
      ({
        type,
        body,
        envelope_id: envelopeId,
        ack,
      }: {
        type: string;
        body: unknown;
        envelope_id: string;
        ack: () => Promise<void>;
      }) => void handle({ type, body, envelopeId, ack }),
    );
    await this.client.start();
  }

  async close() {
    await this.client?.disconnect();
  }
}
