import { Injectable } from '@nestjs/common';
import { ErrorCode, type WebAPIPlatformError } from '@slack/web-api';
import { SlackMessages } from './constants/slack.messages';
import { SlackClient } from './slack.client';
import { SlackRejectedError } from './slack.error';
import type { SlackMessageContent, SlackPostedMessage } from './types/slack.interface';

@Injectable()
export class SlackRepository {
  constructor(private readonly slackClient: SlackClient) {}

  async postMessage(channel: string, content: SlackMessageContent): Promise<SlackPostedMessage> {
    const response = await this.call(() =>
      this.getClient().chat.postMessage({
        channel,
        text: content.text,
        blocks: content.blocks,
        unfurl_links: false,
        unfurl_media: false,
      }),
    );
    return { channel: response.channel ?? channel, ts: response.ts ?? '' };
  }

  async updateMessage(channel: string, ts: string, content: SlackMessageContent) {
    await this.call(() =>
      this.getClient().chat.update({
        channel,
        ts,
        text: content.text,
        blocks: content.blocks,
      }),
    );
  }

  async findLocale(userId: string) {
    const response = await this.call(() =>
      this.getClient().users.info({ user: userId, include_locale: true }),
    );
    return response.user?.locale ?? null;
  }

  private async call<T>(request: () => Promise<T>) {
    try {
      return await request();
    } catch (error) {
      if (!this.isPlatformError(error)) {
        throw error;
      }
      const code = error.data.error;
      throw new SlackRejectedError(`${SlackMessages.REJECTED}: ${code}`, code);
    }
  }

  private isPlatformError(error: unknown): error is WebAPIPlatformError {
    return (
      error instanceof Error &&
      'code' in error &&
      error.code === ErrorCode.PlatformError &&
      'data' in error
    );
  }

  private getClient() {
    if (!this.slackClient.instance) {
      throw new Error(SlackMessages.DISABLED);
    }
    return this.slackClient.instance;
  }
}
