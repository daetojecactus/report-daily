import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogLevel, WebClient } from '@slack/web-api';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { SLACK_RETRIES } from './constants/slack.constants';

@Injectable()
export class SlackClient {
  readonly instance: WebClient | null;

  constructor(configService: ConfigService<AppEnvs, true>) {
    const token = configService.get('SLACK_BOT_TOKEN', { infer: true });
    this.instance = token
      ? new WebClient(token, { retryConfig: { retries: SLACK_RETRIES }, logLevel: LogLevel.ERROR })
      : null;
  }
}
