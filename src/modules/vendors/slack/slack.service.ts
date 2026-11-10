import { Injectable } from '@nestjs/common';
import { ErrorCode, type WebAPIPlatformError } from '@slack/web-api';
import { SLACK_USER_ID_PATTERN } from 'src/common/constants/slack.constants';
import { Channel } from 'src/common/enums/channel.enums';
import { ChatUnreachableError } from 'src/common/errors/chat-unreachable.error';
import type { ChatChannel, Screen } from 'src/common/interfaces/chat-channel.interface';
import { SLACK_MESSAGE_GONE_ERRORS, SLACK_UNREACHABLE_ERRORS } from './constants/slack.constants';
import { SlackClient } from './slack.client';
import { SlackRenderer } from './slack.renderer';
import { SlackRepository } from './slack.repository';

@Injectable()
export class SlackService implements ChatChannel {
  readonly channel = Channel.SLACK;

  constructor(
    private readonly slackClient: SlackClient,
    private readonly slackRepository: SlackRepository,
    private readonly slackRenderer: SlackRenderer,
  ) {}

  isEnabled() {
    return this.slackClient.instance !== null;
  }

  isUserId(value: string) {
    return SLACK_USER_ID_PATTERN.test(value);
  }

  async sendScreen(chatId: string, screen: Screen) {
    const { ts } = await this.reachChat(() =>
      this.slackRepository.postMessage(chatId, this.slackRenderer.render(screen)),
    );
    return ts;
  }

  async editScreen(chatId: string, messageId: string, screen: Screen) {
    try {
      await this.reachChat(() =>
        this.slackRepository.updateMessage(chatId, messageId, this.slackRenderer.render(screen)),
      );
    } catch (error) {
      if (!this.isPlatformError(error, SLACK_MESSAGE_GONE_ERRORS)) {
        throw error;
      }
      await this.sendScreen(chatId, screen);
    }
  }

  answerButton() {
    return Promise.resolve();
  }

  setDefaultCommands() {
    return Promise.resolve();
  }

  setChatCommands() {
    return Promise.resolve();
  }

  private async reachChat<T>(call: () => Promise<T>) {
    try {
      return await call();
    } catch (error) {
      if (this.isPlatformError(error, SLACK_UNREACHABLE_ERRORS)) {
        throw new ChatUnreachableError(error.data.error);
      }
      throw error;
    }
  }

  private isPlatformError(error: unknown, codes: string[]): error is WebAPIPlatformError {
    return (
      error instanceof Error &&
      'code' in error &&
      error.code === ErrorCode.PlatformError &&
      'data' in error &&
      codes.includes((error as WebAPIPlatformError).data.error)
    );
  }
}
