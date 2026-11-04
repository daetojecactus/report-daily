import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import type { GitLabUser } from 'src/modules/vendors/gitlab/gitlab.interface';

export interface FakeGitLabUser extends GitLabUser {
  hasActivity: boolean;
}

const API_PREFIX = '/api/v4';
const CONTROL_USERS_PATH = '/control/users';
const USERS_PATH = '/users';
const USER_PATH = /^\/users\/(\d+)$/;
const EVENTS_PATH = /^\/users\/(\d+)\/events$/;
const DEFAULT_PER_PAGE = 20;

export async function startFakeGitLab() {
  const users: FakeGitLabUser[] = [];

  const send = (response: ServerResponse, status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };

  const toPublic = (user: FakeGitLabUser): GitLabUser => ({
    id: user.id,
    username: user.username,
    name: user.name,
    state: user.state,
    avatar_url: user.avatar_url,
    web_url: user.web_url,
  });

  const findUser = (id: string) => users.find((user) => user.id === Number(id));

  const route = async (request: IncomingMessage, response: ServerResponse) => {
    let raw = '';
    for await (const chunk of request) {
      raw += String(chunk);
    }
    const url = new URL(request.url ?? '', 'http://localhost');

    if (url.pathname === CONTROL_USERS_PATH) {
      users.push(JSON.parse(raw) as FakeGitLabUser);
      send(response, 200, {});
      return;
    }

    const path = url.pathname.slice(API_PREFIX.length);
    if (path === USERS_PATH) {
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const perPage = Number(
        url.searchParams.get('per_page') ?? DEFAULT_PER_PAGE,
      );
      send(
        response,
        200,
        users
          .filter(
            (user) =>
              user.name.toLowerCase().includes(search) ||
              user.username.toLowerCase().includes(search),
          )
          .slice(0, perPage)
          .map(toPublic),
      );
      return;
    }

    const eventsPath = EVENTS_PATH.exec(path);
    const userPath = USER_PATH.exec(path);
    const user = findUser(eventsPath?.[1] ?? userPath?.[1] ?? '');
    if (!user) {
      send(response, 404, { message: '404 Not Found' });
      return;
    }
    if (eventsPath) {
      send(response, 200, user.hasActivity ? [{ id: 1 }] : []);
      return;
    }
    send(response, 200, toPublic(user));
  };

  const server = createServer((request, response) => {
    void route(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

export const fakeGitLab = {
  async addUser(user: FakeGitLabUser) {
    await fetch(`${process.env.GITLAB_URL}${CONTROL_USERS_PATH}`, {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },
};
