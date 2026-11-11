import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

export interface FakeSlackApiRequest {
  method: string;
  body: Record<string, unknown>;
}

export interface FakeSlackApiFailure {
  method: string;
  error: string;
}

const API_PREFIX = '/api/';
const CONTROL_PREFIX = '/control/';
const WAIT_STEP_MS = 25;
const WAIT_TIMEOUT_MS = 10_000;
const JSON_FIELDS = ['blocks'];

function parseBody(raw: string, contentType: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  if (contentType?.includes('application/json')) {
    return JSON.parse(raw) as Record<string, unknown>;
  }
  const body: Record<string, unknown> = Object.fromEntries(new URLSearchParams(raw));
  for (const field of JSON_FIELDS) {
    if (typeof body[field] === 'string') {
      body[field] = JSON.parse(body[field]);
    }
  }
  return body;
}

export async function startFakeSlackApi() {
  let requests: FakeSlackApiRequest[] = [];
  let failures: FakeSlackApiFailure[] = [];
  let locales: Record<string, string> = {};
  let nextTs = 1;
  const send = (response: ServerResponse, body: unknown) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  const callMethod = (method: string, body: Record<string, unknown>, response: ServerResponse) => {
    requests.push({ method, body });
    const failure = failures.find((item) => item.method === method);
    if (failure) {
      failures = failures.filter((item) => item !== failure);
      send(response, { ok: false, error: failure.error });
      return;
    }
    switch (method) {
      case 'chat.postMessage':
        send(response, { ok: true, channel: body.channel, ts: `1731240000.${nextTs++}` });
        return;
      case 'chat.update':
        send(response, { ok: true, channel: body.channel, ts: body.ts });
        return;
      case 'users.info': {
        const locale = locales[String(body.user)];
        send(response, { ok: true, user: { id: body.user, ...(locale ? { locale } : {}) } });
        return;
      }
      default:
        send(response, { ok: false, error: 'unknown_method' });
    }
  };
  const control = (action: string, body: Record<string, unknown>, response: ServerResponse) => {
    switch (action) {
      case 'requests':
        send(response, requests);
        return;
      case 'failures':
        failures.push(body as unknown as FakeSlackApiFailure);
        send(response, {});
        return;
      case 'locales':
        locales = { ...locales, ...(body as Record<string, string>) };
        send(response, {});
        return;
      case 'reset':
        requests = [];
        failures = [];
        locales = {};
        send(response, {});
        return;
      default:
        response.writeHead(404).end();
    }
  };
  const route = async (request: IncomingMessage, response: ServerResponse) => {
    let raw = '';
    for await (const chunk of request) {
      raw += String(chunk);
    }
    const url = request.url ?? '';
    const body = parseBody(raw, request.headers['content-type']);
    if (url.startsWith(CONTROL_PREFIX)) {
      control(url.slice(CONTROL_PREFIX.length), body, response);
      return;
    }
    if (url.startsWith(API_PREFIX)) {
      callMethod(url.slice(API_PREFIX.length).split('?')[0], body, response);
      return;
    }
    response.writeHead(404).end();
  };
  const server = createServer((request, response) => {
    void route(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}${API_PREFIX}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function callControl<T>(action: string, body?: unknown): Promise<T> {
  const base = (process.env.SLACK_API_URL ?? '').replace(API_PREFIX, CONTROL_PREFIX);
  const response = await fetch(`${base}${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return (await response.json()) as T;
}

export const fakeSlackApi = {
  reset() {
    return callControl('reset');
  },

  fail(failure: FakeSlackApiFailure) {
    return callControl('failures', failure);
  },

  setLocale(userId: string, locale: string) {
    return callControl('locales', { [userId]: locale });
  },

  requests() {
    return callControl<FakeSlackApiRequest[]>('requests');
  },

  async waitForRequest(method: string, matches: (body: Record<string, unknown>) => boolean) {
    const deadline = Date.now() + WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const request = (await this.requests()).find(
        (item) => item.method === method && matches(item.body),
      );
      if (request) {
        return request.body;
      }
      await sleep(WAIT_STEP_MS);
    }
    throw new Error(`Fake Slack API did not get ${method}`);
  },
};
