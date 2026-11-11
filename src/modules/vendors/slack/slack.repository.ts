import { Injectable } from '@nestjs/common';
import { SlackMessages } from './constants/slack.messages';
import { SlackClient } from './slack.client';
import type { SlackMessageContent, SlackPostedMessage } from './types/slack.interface';

@Injectable()
export class SlackRepository {
  constructor(private readonly slackClient: SlackClient) {}

  async postMessage(channel: string, content: SlackMessageContent): Promise<SlackPostedMessage> {
    const response = await this.getClient().chat.postMessage({
      channel,
      text: content.text,
      blocks: content.blocks,
      unfurl_links: false,
      unfurl_media: false,
    });
    return { channel: response.channel ?? channel, ts: response.ts ?? '' };
  }

  async updateMessage(channel: string, ts: string, content: SlackMessageContent) {
    await this.getClient().chat.update({
      channel,
      ts,
      text: content.text,
      blocks: content.blocks,
    });
  }

  private getClient() {
    if (!this.slackClient.instance) {
      throw new Error(SlackMessages.DISABLED);
    }
    return this.slackClient.instance;
  }
}
