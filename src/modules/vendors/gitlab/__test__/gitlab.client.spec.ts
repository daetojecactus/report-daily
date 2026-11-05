import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ConfigService } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';
import {
  afterAll,
  assert,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { GitLabClient } from '../gitlab.client';
import { GitLabCertificateError, GitLabRetryableError } from '../gitlab.error';

const TOKEN = 'glpat-client-test-secret-token';

interface ReceivedRequest {
  method?: string;
  url?: string;
  token?: string | string[];
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

function receive(request: IncomingMessage, response: ServerResponse) {
  received.push({
    method: request.method,
    url: request.url,
    token: request.headers['private-token'],
  });
  reply(response);
}

function replyWith(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Reply {
  return (response) => {
    response.writeHead(status, {
      'content-type': 'application/json',
      ...headers,
    });
    response.end(body);
  };
}

function createClient(gitlabUrl = serverUrl) {
  const values: Record<string, string> = {
    GITLAB_URL: gitlabUrl,
    GITLAB_TOKEN: TOKEN,
  };
  return new GitLabClient({
    get: (key: string) => values[key],
  } as unknown as ConfigService<AppEnvs, true>);
}

async function closedUrl() {
  const closed = createServer();
  const url = await listen(closed);
  await close(closed);
  return url;
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

describe('GitLabClient', () => {
  beforeAll(async () => {
    server = createServer(receive);
    serverUrl = await listen(server);
  });

  afterAll(async () => {
    await close(server);
  });

  beforeEach(() => {
    received = [];
    reply = replyWith(200, '[]');
  });

  it('sends the token header and the query to the API path', async () => {
    reply = replyWith(200, '[{"id":1}]', { 'x-next-page': '2' });

    const response = await createClient().get('/users', {
      search: 'Анна С',
      active: true,
      per_page: 10,
    });

    expect(response).toMatchObject({
      ok: true,
      status: 200,
      body: '[{"id":1}]',
    });
    expect(response.headers.get('x-next-page')).toBe('2');
    expect(received).toEqual([
      {
        method: 'GET',
        url: '/api/v4/users?search=%D0%90%D0%BD%D0%BD%D0%B0+%D0%A1&active=true&per_page=10',
        token: TOKEN,
      },
    ]);
  });

  it('keeps the path of GITLAB_URL and drops trailing slashes', async () => {
    await createClient(`${serverUrl}/gitlab//`).get('/users/7');

    expect(received[0].url).toBe('/gitlab/api/v4/users/7');
  });

  it.each([404, 401, 502])(
    'returns a response with status %i as it is',
    async (status) => {
      reply = replyWith(status, '<html>error</html>');

      expect(await createClient().get('/users')).toMatchObject({
        ok: false,
        status,
        body: '<html>error</html>',
      });
    },
  );

  it.each([
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'CERT_HAS_EXPIRED',
  ])('reports the untrusted certificate %s without retrying', async (code) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new TypeError('fetch failed', {
        cause: Object.assign(new Error('certificate'), { code }),
      }),
    );

    const error = await catchErrorWithoutToken(
      createClient().get('/users'),
      GitLabCertificateError,
    );

    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(error.message).toContain('NODE_EXTRA_CA_CERTS');
    expect(error.message).toContain(code);
    fetchSpy.mockRestore();
  });

  it('retries when nothing listens on the port', async () => {
    const error = await catchErrorWithoutToken(
      createClient(await closedUrl()).get('/users'),
      GitLabRetryableError,
    );

    expect(error.message).toContain('ECONNREFUSED');
  });

  it('runs at most eight requests at a time', async () => {
    let active = 0;
    let mostActive = 0;
    reply = (response) => {
      active += 1;
      mostActive = Math.max(mostActive, active);
      setTimeout(() => {
        active -= 1;
        replyWith(200, '[]')(response);
      }, 20);
    };
    const client = createClient();

    await Promise.all(Array.from({ length: 20 }, () => client.get('/users')));

    expect(received).toHaveLength(20);
    expect(mostActive).toBe(8);
  });

  it('frees the slot of a failed request', async () => {
    const client = createClient(await closedUrl());

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => client.get('/users')),
    );
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('[]'));

    expect(results.every(({ status }) => status === 'rejected')).toBe(true);
    expect(await client.get('/users')).toMatchObject({ ok: true, body: '[]' });
    fetchSpy.mockRestore();
  });
});
