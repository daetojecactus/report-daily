import { Injectable } from '@nestjs/common';
import { getFailureReason } from 'src/common/utils/error.util';
import {
  TELEGRAM_ALLOWED_UPDATES,
  TELEGRAM_POLL_TIMEOUT_SECONDS,
  TELEGRAM_REQUEST_TIMEOUT_MS,
  TELEGRAM_SERVER_ERROR,
  TELEGRAM_TOO_MANY_REQUESTS,
} from './constants/telegram.constants';
import { TelegramMessages } from './constants/telegram.messages';
import { TelegramClient } from './telegram.client';
import { TelegramMethod } from './types/telegram.enums';
import { TelegramRejectedError, TelegramRetryableError } from './telegram.error';
import type {
  TelegramBotCommand,
  TelegramCallOptions,
  TelegramCommandScope,
  TelegramHttpResponse,
  TelegramMessage,
  TelegramMessageContent,
  TelegramResponse,
  TelegramUpdate,
} from './types/telegram.interface';

@Injectable()
export class TelegramRepository {
  constructor(private readonly telegramClient: TelegramClient) {}

  getUpdates(offset: number, signal: AbortSignal) {
    return this.call<TelegramUpdate[]>(
      TelegramMethod.GET_UPDATES,
      {
        offset,
        timeout: TELEGRAM_POLL_TIMEOUT_SECONDS,
        allowed_updates: TELEGRAM_ALLOWED_UPDATES,
      },
      {
        signal,
        timeoutMs: TELEGRAM_POLL_TIMEOUT_SECONDS * 1000 + TELEGRAM_REQUEST_TIMEOUT_MS,
      },
    );
  }

  async deleteWebhook() {
    await this.call(TelegramMethod.DELETE_WEBHOOK, {});
  }

  sendMessage(chatId: string, content: TelegramMessageContent) {
    return this.call<TelegramMessage>(TelegramMethod.SEND_MESSAGE, {
      chat_id: chatId,
      ...content,
    });
  }

  async editMessageText(chatId: string, messageId: number, content: TelegramMessageContent) {
    await this.call(TelegramMethod.EDIT_MESSAGE_TEXT, {
      chat_id: chatId,
      message_id: messageId,
      ...content,
    });
  }

  async answerCallbackQuery(callbackQueryId: string) {
    await this.call(TelegramMethod.ANSWER_CALLBACK_QUERY, {
      callback_query_id: callbackQueryId,
    });
  }

  async setMyCommands(
    commands: TelegramBotCommand[],
    scope: TelegramCommandScope,
    languageCode: string | null,
  ) {
    await this.call(TelegramMethod.SET_MY_COMMANDS, {
      commands,
      scope,
      ...(languageCode ? { language_code: languageCode } : {}),
    });
  }

  private async call<T>(
    method: TelegramMethod,
    params: object,
    options?: TelegramCallOptions,
  ): Promise<T> {
    const response = await this.telegramClient.post(method, params, options);
    const body = this.parse<T>(method, response);
    if (body.ok) {
      return body.result as T;
    }

    const code = body.error_code ?? response.status;
    const message = `${TelegramMessages.API_ERROR}: ${method}: ${code} ${body.description ?? ''}`;
    if (code === TELEGRAM_TOO_MANY_REQUESTS || code >= TELEGRAM_SERVER_ERROR) {
      throw new TelegramRetryableError(message, body.parameters?.retry_after ?? null);
    }
    throw new TelegramRejectedError(message, code, body.description ?? '');
  }

  private parse<T>(method: TelegramMethod, response: TelegramHttpResponse) {
    try {
      return JSON.parse(response.body) as TelegramResponse<T>;
    } catch (error) {
      throw new TelegramRetryableError(
        `${TelegramMessages.INVALID_RESPONSE}: ${method}: ${response.status} ${getFailureReason(error)}`,
      );
    }
  }
}
