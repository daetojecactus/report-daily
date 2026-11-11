import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogLevel, WebClient } from '@slack/web-api';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { SLACK_RETRIES, SLACK_URL_TRAILING_SLASH } from './constants/slack.constants';

@Injectable()
export class SlackClient {
  readonly instance: WebClient | null;
  readonly apiUrl: string;

  constructor(configService: ConfigService<AppEnvs, true>) {
    const apiUrl = configService.get('SLACK_API_URL', { infer: true });
    this.apiUrl = apiUrl.endsWith(SLACK_URL_TRAILING_SLASH)
      ? apiUrl
      : `${apiUrl}${SLACK_URL_TRAILING_SLASH}`;
    const token = configService.get('SLACK_BOT_TOKEN', { infer: true });
    this.instance = token
      ? new WebClient(token, {
          slackApiUrl: this.apiUrl,
          retryConfig: { retries: SLACK_RETRIES },
          logLevel: LogLevel.ERROR,
        })
      : null;
  }
}
