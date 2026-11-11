import { Injectable } from '@nestjs/common';
import { ErrorCode, type WebAPIPlatformError } from '@slack/web-api';
import { SLACK_USER_ID_PATTERN } from 'src/common/constants/slack.constants';
import { Channel } from 'src/common/channel/types/channel.enums';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import { ChatUnreachableError } from 'src/common/channel/chat-unreachable.error';
import type {
  ChatChannel,
  ChatEvent,
  ChatInput,
  Screen,
} from 'src/common/channel/types/chat-channel.interface';
import {
  SLACK_BLOCK_ACTIONS_SCHEMA,
  SLACK_COMMAND_PREFIX,
  SLACK_COMMAND_WORDS,
  SLACK_DEFAULT_COMMAND,
  SLACK_ENVELOPE_TYPE_SCHEMA,
  SLACK_MESSAGE_EVENT_SCHEMA,
  SLACK_SLASH_COMMAND_SCHEMA,
  SLACK_WORD_SEPARATOR,
} from './constants/slack-events.constants';
import { SLACK_MESSAGE_GONE_ERRORS, SLACK_UNREACHABLE_ERRORS } from './constants/slack.constants';
import { SlackMessages } from './constants/slack.messages';
import { SlackElementType, SlackEnvelopeType } from './types/slack.enums';
import { SlackRejectedError } from './slack.error';
import { SlackClient } from './slack.client';
import { SlackFormatter } from './slack.formatter';
import { SlackRenderer } from './slack.renderer';
import { SlackRepository } from './slack.repository';

@Injectable()
export class SlackService implements ChatChannel {
  readonly channel = Channel.SLACK;

  constructor(
    private readonly slackClient: SlackClient,
    private readonly slackRepository: SlackRepository,
    private readonly slackRenderer: SlackRenderer,
    private readonly slackFormatter: SlackFormatter,
  ) {}

  isEnabled() {
    return this.slackClient.instance !== null;
  }

  toChatEvent(type: string, body: unknown): ChatEvent | null {
    switch (SLACK_ENVELOPE_TYPE_SCHEMA.safeParse(type).data) {
      case SlackEnvelopeType.SLASH_COMMANDS:
        return this.fromSlashCommand(body);
      case SlackEnvelopeType.EVENTS_API:
        return this.fromMessage(body);
      case SlackEnvelopeType.INTERACTIVE:
        return this.fromBlockActions(body);
      default:
        return null;
    }
  }

  findEventId(body: unknown) {
    return SLACK_MESSAGE_EVENT_SCHEMA.safeParse(body).data?.event_id ?? null;
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
      if (
        !(error instanceof SlackRejectedError) ||
        !SLACK_MESSAGE_GONE_ERRORS.includes(error.code)
      ) {
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

  private fromSlashCommand(body: unknown): ChatEvent | null {
    const command = SLACK_SLASH_COMMAND_SCHEMA.safeParse(body);
    if (!command.success) {
      return null;
    }
    const { user_id: userId, text } = command.data;
    const [word = ''] = text.trim().toLowerCase().split(SLACK_WORD_SEPARATOR);
    return this.toEvent(userId, userId, {
      type: ChatInputType.COMMAND,
      command: word || SLACK_DEFAULT_COMMAND,
    });
  }

  private fromMessage(body: unknown): ChatEvent | null {
    const message = SLACK_MESSAGE_EVENT_SCHEMA.safeParse(body);
    if (!message.success || message.data.event.bot_id || message.data.event.subtype) {
      return null;
    }
    const { user, channel } = message.data.event;
    const text = this.slackFormatter.toPlainText(message.data.event.text);
    const word = text.trim().toLowerCase().replace(SLACK_COMMAND_PREFIX, '');
    return this.toEvent(
      user,
      channel,
      SLACK_COMMAND_WORDS.includes(word)
        ? { type: ChatInputType.COMMAND, command: word }
        : { type: ChatInputType.TEXT, text },
    );
  }

  private fromBlockActions(body: unknown): ChatEvent | null {
    const actions = SLACK_BLOCK_ACTIONS_SCHEMA.safeParse(body);
    if (!actions.success) {
      return null;
    }
    const { user, channel, message } = actions.data;
    const [action] = actions.data.actions;
    return this.toEvent(
      user.id,
      channel.id,
      action.type === SlackElementType.BUTTON
        ? { type: ChatInputType.BUTTON, data: action.value, messageId: message.ts, callbackId: '' }
        : { type: ChatInputType.PICKED_USER, externalId: action.selected_user },
    );
  }

  private toEvent(userId: string, chatId: string, input: ChatInput): ChatEvent {
    return { channel: Channel.SLACK, userId, chatId, languageCode: null, input };
  }

  private async reachChat<T>(call: () => Promise<T>) {
    try {
      return await call();
    } catch (error) {
      if (!this.isPlatformError(error)) {
        throw error;
      }
      const code = error.data.error;
      if (SLACK_UNREACHABLE_ERRORS.includes(code)) {
        throw new ChatUnreachableError(code);
      }
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
}
