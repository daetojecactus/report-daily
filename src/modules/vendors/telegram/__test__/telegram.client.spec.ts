import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ConfigService } from '@nestjs/config';
import {
  afterAll,
  assert,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { TelegramClient } from '../telegram.client';
import { TelegramMethod } from '../telegram.enums';
import { TelegramRetryableError } from '../telegram.error';

const TOKEN = '300000000:client-test-secret-token';

interface ReceivedRequest {
  method?: string;
  url?: string;
  contentType?: string;
  body: string;
}

type Reply = (response: ServerResponse) => void;

let server: Server;
let serverUrl: string;
let received: ReceivedRequest[] = [];
let reply: Reply;

function listen(target: Server) {
  return new Promise<string>((resolve) => {
    target.listen(0, '127.0.0.1', () => {
      const { port } = target.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function close(target: Server) {
  target.closeAllConnections();
  return new Promise<void>((resolve) => target.close(() => resolve()));
}

async function receive(request: IncomingMessage, response: ServerResponse) {
  let body = '';
  for await (const chunk of request) {
    body += String(chunk);
  }
  received.push({
    method: request.method,
    url: request.url,
    contentType: request.headers['content-type'],
    body,
  });
  reply(response);
}

function replyJson(status: number, body: unknown): Reply {
  return (response) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
}

function createClient(apiUrl = serverUrl) {
  const values: Record<string, string> = {
    TELEGRAM_API_URL: apiUrl,
    TELEGRAM_BOT_TOKEN: TOKEN,
  };
  return new TelegramClient({
    get: (key: string) => values[key],
  } as unknown as ConfigService<AppEnvs, true>);
}

async function catchErrorWithoutToken<T extends Error>(
  call: Promise<unknown>,
  errorClass: new (...args: never[]) => T,
) {
  const error = await call.then(
    () => null,
    (reason: unknown) => reason,
  );
  assert(error instanceof errorClass, String(error));
  expect(error.message).not.toContain(TOKEN);
  expect(error.stack).not.toContain(TOKEN);
  return error;
}

describe('TelegramClient', () => {
  beforeAll(async () => {
    server = createServer((request, response) => {
      void receive(request, response);
    });
    serverUrl = await listen(server);
  });

  afterAll(async () => {
    await close(server);
  });

  beforeEach(() => {
    received = [];
    reply = replyJson(200, { ok: true, result: true });
  });

  it('posts JSON to the bot method url and returns the status and body', async () => {
    reply = replyJson(200, { ok: true, result: { message_id: 7 } });
    const params = { chat_id: '300000001', text: '<b>Hi</b>' };

    await expect(
      createClient(`${serverUrl}/`).post(TelegramMethod.SEND_MESSAGE, params),
    ).resolves.toEqual({
      status: 200,
      body: JSON.stringify({ ok: true, result: { message_id: 7 } }),
    });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      method: 'POST',
      url: `/bot${TOKEN}/sendMessage`,
      contentType: 'application/json',
    });
    expect(JSON.parse(received[0].body)).toEqual(params);
  });

  it('returns an error response as it is', async () => {
    reply = (response) => {
      response.writeHead(502, { 'content-type': 'text/html' });
      response.end('<html><body>502 Bad Gateway</body></html>');
    };

    await expect(
      createClient().post(TelegramMethod.SEND_MESSAGE, {}),
    ).resolves.toEqual({
      status: 502,
      body: '<html><body>502 Bad Gateway</body></html>',
    });
  });

  it('throws a retryable error when nothing listens on the port', async () => {
    const closedServer = createServer();
    const closedUrl = await listen(closedServer);
    await close(closedServer);

    const error = await catchErrorWithoutToken(
      createClient(closedUrl).post(TelegramMethod.GET_UPDATES, {}),
      TelegramRetryableError,
    );

    expect(error.retryAfterSeconds).toBeNull();
    expect(error.message).toContain('ECONNREFUSED');
  });

  it('throws a retryable error on timeout', async () => {
    reply = () => {};

    const error = await catchErrorWithoutToken(
      createClient().post(TelegramMethod.GET_UPDATES, {}, { timeoutMs: 50 }),
      TelegramRetryableError,
    );

    expect(error.message).toContain('TimeoutError');
  });

  it('aborts the call with an external signal', async () => {
    const controller = new AbortController();
    reply = () => controller.abort();

    const error = await catchErrorWithoutToken(
      createClient().post(
        TelegramMethod.GET_UPDATES,
        {},
        { signal: controller.signal, timeoutMs: 60_000 },
      ),
      TelegramRetryableError,
    );

    expect(error.message).toContain('AbortError');
  });
});
