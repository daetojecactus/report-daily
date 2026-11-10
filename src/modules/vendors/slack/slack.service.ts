import { Injectable } from '@nestjs/common';
import { ErrorCode, type WebAPIPlatformError } from '@slack/web-api';
import { SLACK_USER_ID_PATTERN } from 'src/common/constants/slack.constants';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import { ChatUnreachableError } from 'src/common/errors/chat-unreachable.error';
import type {
  ChatChannel,
  ChatEvent,
  ChatInput,
  Screen,
} from 'src/common/interfaces/chat-channel.interface';
import {
  SLACK_BLOCK_ACTIONS_SCHEMA,
  SLACK_COMMAND_PREFIX,
  SLACK_COMMAND_WORDS,
  SLACK_DEFAULT_COMMAND,
  SLACK_ENVELOPE_TYPE_SCHEMA,
  SLACK_MESSAGE_EVENT_SCHEMA,
  SLACK_MESSAGE_GONE_ERRORS,
  SLACK_SLASH_COMMAND_SCHEMA,
  SLACK_UNREACHABLE_ERRORS,
  SLACK_WORD_SEPARATOR,
} from './constants/slack.constants';
import { SlackElementType, SlackEnvelopeType } from './slack.enums';
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
    const { user, channel, text } = message.data.event;
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
