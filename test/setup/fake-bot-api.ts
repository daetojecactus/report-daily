import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import type {
  TelegramMessage,
  TelegramUpdate,
} from 'src/modules/vendors/telegram/telegram.interface';

export type FakeUpdate = Omit<TelegramUpdate, 'update_id'>;

export interface FakeBotApiRequest {
  method: string;
  body: Record<string, unknown>;
  at: number;
}

export interface FakeBotApiFailure {
  method: string;
  code: number;
  description: string;
  retryAfter?: number;
}

interface PendingPoll {
  offset: number;
  response: ServerResponse;
  timer: NodeJS.Timeout;
}

const BOT_METHOD_PATH = /^\/bot[^/]+\/(\w+)$/;
const CONTROL_PREFIX = '/control/';
const MAX_POLL_TIMEOUT_MS = 25_000;
const WAIT_STEP_MS = 25;
const WAIT_TIMEOUT_MS = 10_000;

let nextMessageId = 1;

export async function startFakeBotApi() {
  let nextUpdateId = 1;
  let updates: TelegramUpdate[] = [];
  let requests: FakeBotApiRequest[] = [];
  let failures: FakeBotApiFailure[] = [];
  const polls = new Set<PendingPoll>();

  const send = (response: ServerResponse, status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };

  const answerPoll = (poll: PendingPoll, result: TelegramUpdate[]) => {
    clearTimeout(poll.timer);
    polls.delete(poll);
    send(poll.response, 200, { ok: true, result });
  };

  const flushPolls = () => {
    for (const poll of polls) {
      const available = updates.filter((update) => update.update_id >= poll.offset);
      if (available.length > 0) {
        answerPoll(poll, available);
      }
    }
  };

  const getUpdates = (body: Record<string, unknown>, response: ServerResponse) => {
    const offset = Number(body.offset ?? 0);
    updates = updates.filter((update) => update.update_id >= offset);
    if (updates.length > 0) {
      send(response, 200, { ok: true, result: updates });
      return;
    }

    const timeoutMs = Math.min(Number(body.timeout ?? 0) * 1000, MAX_POLL_TIMEOUT_MS);
    const poll: PendingPoll = {
      offset,
      response,
      timer: setTimeout(() => answerPoll(poll, []), timeoutMs),
    };
    polls.add(poll);
    response.on('close', () => {
      clearTimeout(poll.timer);
      polls.delete(poll);
    });
  };

  const fail = (method: string, response: ServerResponse) => {
    const failure = failures.find((item) => item.method === method);
    if (!failure) {
      return false;
    }
    failures = failures.filter((item) => item !== failure);
    send(response, failure.code, {
      ok: false,
      error_code: failure.code,
      description: failure.description,
      parameters:
        failure.retryAfter === undefined ? undefined : { retry_after: failure.retryAfter },
    });
    return true;
  };

  const callMethod = (method: string, body: Record<string, unknown>, response: ServerResponse) => {
    requests.push({ method, body, at: Date.now() });
    const isMessage = method === 'sendMessage' || method === 'editMessageText';
    const result: TelegramMessage | boolean = isMessage
      ? {
          message_id: Number(body.message_id ?? nextMessageId++),
          chat: { id: Number(body.chat_id), type: 'private' },
          text: String(body.text),
        }
      : true;
    send(response, 200, { ok: true, result });
  };

  const control = (action: string, body: Record<string, unknown>, response: ServerResponse) => {
    switch (action) {
      case 'updates': {
        const update = { ...body, update_id: nextUpdateId++ };
        updates.push(update);
        flushPolls();
        send(response, 200, { update_id: update.update_id });
        return;
      }
      case 'requests':
        send(response, 200, requests);
        return;
      case 'failures':
        failures.push(body as unknown as FakeBotApiFailure);
        send(response, 200, {});
        return;
      case 'reset':
        requests = [];
        failures = [];
        send(response, 200, {});
        return;
      default:
        send(response, 404, {});
    }
  };

  const route = async (request: IncomingMessage, response: ServerResponse) => {
    let raw = '';
    for await (const chunk of request) {
      raw += String(chunk);
    }
    const body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    const url = request.url ?? '';

    if (url.startsWith(CONTROL_PREFIX)) {
      control(url.slice(CONTROL_PREFIX.length), body, response);
      return;
    }
    const method = BOT_METHOD_PATH.exec(url)?.[1];
    if (!method) {
      send(response, 404, {
        ok: false,
        error_code: 404,
        description: 'Not Found',
      });
      return;
    }
    if (fail(method, response)) {
      return;
    }
    if (method === 'getUpdates') {
      getUpdates(body, response);
      return;
    }
    callMethod(method, body, response);
  };

  const server = createServer((request, response) => {
    void route(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      for (const poll of polls) {
        answerPoll(poll, []);
      }
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function callControl<T>(action: string, body?: unknown): Promise<T> {
  const response = await fetch(`${process.env.TELEGRAM_API_URL}${CONTROL_PREFIX}${action}`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
  return (await response.json()) as T;
}

export const fakeBotApi = {
  async pushUpdate(update: FakeUpdate) {
    const { update_id } = await callControl<{ update_id: number }>('updates', update);
    return update_id;
  },

  async requests(method?: string) {
    const requests = await callControl<FakeBotApiRequest[]>('requests');
    return method ? requests.filter((request) => request.method === method) : requests;
  },

  async waitForRequest(
    method: string,
    predicate: (body: Record<string, unknown>) => boolean = () => true,
  ) {
    const deadline = Date.now() + WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const request = (await this.requests(method)).find((item) => predicate(item.body));
      if (request) {
        return request.body;
      }
      await sleep(WAIT_STEP_MS);
    }
    throw new Error(`Bot API method ${method} was not called`);
  },

  async fail(failure: FakeBotApiFailure) {
    await callControl('failures', failure);
  },

  async reset() {
    await callControl('reset');
  },
};

export function privateMessage(userId: number, text: string, languageCode = 'en'): FakeUpdate {
  const command = text.startsWith('/') ? text.split(' ')[0] : null;
  return {
    message: {
      message_id: nextMessageId++,
      from: {
        id: userId,
        is_bot: false,
        first_name: 'Test',
        language_code: languageCode,
      },
      chat: { id: userId, type: 'private' },
      text,
      entities: command ? [{ type: 'bot_command', offset: 0, length: command.length }] : undefined,
    },
  };
}

export function pickedUser(userId: number, pickedUserId: number, languageCode = 'en'): FakeUpdate {
  return {
    message: {
      message_id: nextMessageId++,
      from: {
        id: userId,
        is_bot: false,
        first_name: 'Test',
        language_code: languageCode,
      },
      chat: { id: userId, type: 'private' },
      users_shared: { request_id: 1, users: [{ user_id: pickedUserId }] },
    },
  };
}

export function buttonPress(
  userId: number,
  data: string,
  messageId: number,
  languageCode = 'en',
): FakeUpdate {
  return {
    callback_query: {
      id: `callback-${nextMessageId++}`,
      from: {
        id: userId,
        is_bot: false,
        first_name: 'Test',
        language_code: languageCode,
      },
      message: {
        message_id: messageId,
        chat: { id: userId, type: 'private' },
      },
      data,
    },
  };
}
