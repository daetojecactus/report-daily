import { UnrecoverableError } from 'bullmq';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelegramClient } from '../telegram.client';
import { TelegramScopeType } from '../types/telegram.enums';
import { TelegramRejectedError, TelegramRetryableError } from '../telegram.error';
import type { TelegramMessageContent } from '../types/telegram.interface';
import { TelegramRepository } from '../telegram.repository';
import { TelegramParseMode } from '../types/telegram.enums';

const CHAT_ID = '300000001';

const CONTENT: TelegramMessageContent = {
  text: '<b>Hi</b>',
  parse_mode: TelegramParseMode.HTML,
  link_preview_options: { is_disabled: true },
};

const COMMANDS = [{ command: 'start', description: 'Start' }];

function respond(status: number, body: unknown) {
  return {
    status,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

async function catchError<T extends Error>(
  call: Promise<unknown>,
  errorClass: new (...args: never[]) => T,
) {
  const error = await call.then(
    () => null,
    (reason: unknown) => reason,
  );
  assert(error instanceof errorClass, String(error));
  return error;
}

describe('TelegramRepository', () => {
  const client = { post: vi.fn<TelegramClient['post']>() };
  const repository = new TelegramRepository(client as unknown as TelegramClient);

  beforeEach(() => {
    client.post.mockReset();
    client.post.mockResolvedValue(respond(200, { ok: true, result: true }));
  });

  it('sends a message to the chat and returns it', async () => {
    client.post.mockResolvedValue(respond(200, { ok: true, result: { message_id: 7 } }));

    expect(await repository.sendMessage(CHAT_ID, CONTENT)).toEqual({
      message_id: 7,
    });
    expect(client.post).toHaveBeenCalledExactlyOnceWith(
      'sendMessage',
      { chat_id: CHAT_ID, ...CONTENT },
      undefined,
    );
  });

  it('edits a message by its id', async () => {
    await repository.editMessageText(CHAT_ID, 300_000_003, CONTENT);

    expect(client.post).toHaveBeenCalledExactlyOnceWith(
      'editMessageText',
      { chat_id: CHAT_ID, message_id: 300_000_003, ...CONTENT },
      undefined,
    );
  });

  it('answers a callback query', async () => {
    await repository.answerCallbackQuery('callback-1');

    expect(client.post).toHaveBeenCalledExactlyOnceWith(
      'answerCallbackQuery',
      { callback_query_id: 'callback-1' },
      undefined,
    );
  });

  it('sets commands for a scope in a language', async () => {
    await repository.setMyCommands(COMMANDS, { type: TelegramScopeType.ALL_PRIVATE_CHATS }, 'ru');

    expect(client.post).toHaveBeenCalledExactlyOnceWith(
      'setMyCommands',
      {
        commands: COMMANDS,
        scope: { type: 'all_private_chats' },
        language_code: 'ru',
      },
      undefined,
    );
  });

  it('sets commands without a language code', async () => {
    await repository.setMyCommands(
      COMMANDS,
      { type: TelegramScopeType.CHAT, chat_id: CHAT_ID },
      null,
    );

    const [[, params]] = client.post.mock.calls;
    expect(params).toEqual({
      commands: COMMANDS,
      scope: { type: 'chat', chat_id: CHAT_ID },
    });
    expect(params).not.toHaveProperty('language_code');
  });

  it('long polls for messages and button presses', async () => {
    const updates = [{ update_id: 1 }];
    const { signal } = new AbortController();
    client.post.mockResolvedValue(respond(200, { ok: true, result: updates }));

    expect(await repository.getUpdates(300_000_009, signal)).toEqual(updates);

    const [[method, params, options]] = client.post.mock.calls;
    expect(method).toBe('getUpdates');
    expect(params).toEqual({
      offset: 300_000_009,
      timeout: 25,
      allowed_updates: ['message', 'callback_query'],
    });
    expect(options?.signal).toBe(signal);
    expect(options?.timeoutMs).toBeGreaterThan(25_000);
  });

  it('deletes the webhook', async () => {
    await repository.deleteWebhook();

    expect(client.post).toHaveBeenCalledExactlyOnceWith('deleteWebhook', {}, undefined);
  });

  it('rejects a bad request with code and description', async () => {
    client.post.mockResolvedValue(
      respond(400, {
        ok: false,
        error_code: 400,
        description: 'Bad Request: chat not found',
      }),
    );

    const error = await catchError(repository.sendMessage(CHAT_ID, CONTENT), TelegramRejectedError);

    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(error.code).toBe(400);
    expect(error.description).toBe('Bad Request: chat not found');
    expect(error.message).toContain('sendMessage');
  });

  it('rejects with code 403 when the bot is blocked', async () => {
    client.post.mockResolvedValue(
      respond(403, {
        ok: false,
        error_code: 403,
        description: 'Forbidden: bot was blocked by the user',
      }),
    );

    const error = await catchError(repository.sendMessage(CHAT_ID, CONTENT), TelegramRejectedError);

    expect(error.code).toBe(403);
    expect(error.description).toBe('Forbidden: bot was blocked by the user');
  });

  it('uses the HTTP status when the error code is missing', async () => {
    client.post.mockResolvedValue(respond(401, { ok: false, description: 'Unauthorized' }));

    const error = await catchError(repository.deleteWebhook(), TelegramRejectedError);

    expect(error.code).toBe(401);
    expect(error.description).toBe('Unauthorized');
  });

  it('throws a retryable error with retry_after on 429', async () => {
    client.post.mockResolvedValue(
      respond(429, {
        ok: false,
        error_code: 429,
        description: 'Too Many Requests: retry after 7',
        parameters: { retry_after: 7 },
      }),
    );

    const error = await catchError(
      repository.sendMessage(CHAT_ID, CONTENT),
      TelegramRetryableError,
    );

    expect(error).not.toBeInstanceOf(UnrecoverableError);
    expect(error.retryAfterSeconds).toBe(7);
  });

  it('throws a retryable error on a server error', async () => {
    client.post.mockResolvedValue(
      respond(500, {
        ok: false,
        error_code: 500,
        description: 'Internal Server Error',
      }),
    );

    const error = await catchError(
      repository.sendMessage(CHAT_ID, CONTENT),
      TelegramRetryableError,
    );

    expect(error.retryAfterSeconds).toBeNull();
  });

  it('throws a retryable error on a 502 with an HTML body', async () => {
    client.post.mockResolvedValue(respond(502, '<html><body>502 Bad Gateway</body></html>'));

    const error = await catchError(
      repository.sendMessage(CHAT_ID, CONTENT),
      TelegramRetryableError,
    );

    expect(error.retryAfterSeconds).toBeNull();
    expect(error.message).toContain('502');
    expect(error.message).toContain('Telegram returned an invalid response');
  });
});
