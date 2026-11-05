import { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { assert, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitLabClient } from '../gitlab.client';
import { GitLabIssuable } from '../gitlab.enums';
import { GitLabRejectedError, GitLabRetryableError } from '../gitlab.error';
import type { GitLabHttpResponse } from '../gitlab.interface';
import { GitLabRepository } from '../gitlab.repository';

function respond(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): GitLabHttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
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

describe('GitLabRepository', () => {
  const client = { get: vi.fn<GitLabClient['get']>() };
  const repository = new GitLabRepository(client as unknown as GitLabClient);

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    client.get.mockReset();
    client.get.mockResolvedValue(respond(200, []));
  });

  it('searches up to ten active users by name or username', async () => {
    const users = [{ id: 1, username: 'anna', name: 'Anna' }];
    client.get.mockResolvedValue(respond(200, users));

    expect(await repository.searchUsers('ann')).toEqual(users);
    expect(client.get).toHaveBeenCalledWith('/users', {
      search: 'ann',
      active: true,
      per_page: 10,
    });
  });

  it('finds no users when the search is not found', async () => {
    client.get.mockResolvedValue(respond(404, { message: '404 Not Found' }));

    expect(await repository.searchUsers('ann')).toEqual([]);
  });

  it('finds a user by id and null when GitLab has no such user', async () => {
    client.get.mockResolvedValueOnce(respond(200, { id: 7 }));
    client.get.mockResolvedValueOnce(respond(404, { message: 'Not Found' }));

    expect(await repository.findUser(7)).toEqual({ id: 7 });
    expect(await repository.findUser(8)).toBeNull();
    expect(client.get).toHaveBeenCalledWith('/users/7', {});
  });

  it.each([
    [[{ id: 1 }], { id: 1 }],
    [[], null],
  ])('finds the last event of a user in %j', async (events, event) => {
    client.get.mockResolvedValue(respond(200, events));

    expect(await repository.findLastUserEvent(7)).toEqual(event);
    expect(client.get).toHaveBeenCalledWith('/users/7/events', {
      per_page: 1,
    });
  });

  it('reads every page of a list by the next page header', async () => {
    client.get.mockResolvedValueOnce(respond(200, [{ id: 1 }, { id: 2 }], { 'x-next-page': '2' }));
    client.get.mockResolvedValueOnce(respond(200, [{ id: 3 }], { 'x-next-page': '' }));

    expect(await repository.findUserEvents(7, '2026-11-01', '2026-11-05')).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
    expect(client.get.mock.calls).toEqual([
      ['/users/7/events', { after: '2026-11-01', before: '2026-11-05', per_page: 100, page: 1 }],
      ['/users/7/events', { after: '2026-11-01', before: '2026-11-05', per_page: 100, page: 2 }],
    ]);
  });

  it('stops reading a list at the page limit and warns', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    client.get.mockImplementation((_path, query) =>
      Promise.resolve(
        respond(200, [{ id: query?.page }], {
          'x-next-page': String(Number(query?.page) + 1),
        }),
      ),
    );

    const events = await repository.findUserEvents(7, '2026-11-01', '2026-11-05');

    expect(events).toHaveLength(20);
    expect(client.get).toHaveBeenCalledTimes(20);
    expect(warn).toHaveBeenCalledWith(
      { path: '/users/7/events' },
      'GitLab list has more pages than the limit, the rest is skipped',
    );
    warn.mockRestore();
  });

  it('finds an empty list when the list is not found', async () => {
    client.get.mockResolvedValue(respond(404, { message: 'Not Found' }));

    expect(await repository.findNotes(GitLabIssuable.ISSUES, 3, 12)).toEqual([]);
    expect(client.get).toHaveBeenCalledOnce();
  });

  it.each([
    ['/projects/3', () => repository.findProject(3)],
    ['/projects/3/issues/12', () => repository.findIssue(3, 12)],
    ['/projects/3/merge_requests/5', () => repository.findMergeRequest(3, 5)],
  ])('reads one item from %s', async (path, call) => {
    client.get.mockResolvedValue(respond(200, { iid: 1 }));

    expect(await call()).toEqual({ iid: 1 });
    expect(client.get).toHaveBeenCalledWith(path, {});
  });

  it.each([
    ['/projects/3/issues/12/notes', () => repository.findNotes(GitLabIssuable.ISSUES, 3, 12)],
    [
      '/projects/3/merge_requests/5/resource_label_events',
      () => repository.findLabelEvents(GitLabIssuable.MERGE_REQUESTS, 3, 5),
    ],
    [
      '/projects/3/issues/12/resource_state_events',
      () => repository.findStateEvents(GitLabIssuable.ISSUES, 3, 12),
    ],
    ['/projects/3/merge_requests/5/commits', () => repository.findMergeRequestCommits(3, 5)],
    ['/projects/3/merge_requests/5/closes_issues', () => repository.findIssuesClosedOnMerge(3, 5)],
  ])('reads every page of %s', async (path, call) => {
    client.get.mockResolvedValue(respond(200, [{ id: 1 }]));

    expect(await call()).toEqual([{ id: 1 }]);
    expect(client.get).toHaveBeenCalledWith(path, { per_page: 100, page: 1 });
  });

  it.each([
    [[{ iid: 5 }], { iid: 5 }],
    [[], null],
  ])('finds the merge request of a branch in %j', async (found, result) => {
    client.get.mockResolvedValue(respond(200, found));

    expect(await repository.findMergeRequestByBranch(3, '12-login')).toEqual(result);
    expect(client.get).toHaveBeenCalledWith('/projects/3/merge_requests', {
      source_branch: '12-login',
      per_page: 1,
    });
  });

  it.each([
    [GitLabIssuable.ISSUES, '/projects/3/issues'],
    [GitLabIssuable.MERGE_REQUESTS, '/projects/3/merge_requests'],
  ])('reads every %s updated after a moment', async (issuable, path) => {
    client.get.mockResolvedValue(respond(200, [{ iid: 1, project_id: 3 }]));

    expect(await repository.findUpdatedItems(issuable, 3, '2026-11-03T19:00:00.000Z')).toEqual([
      { iid: 1, project_id: 3 },
    ]);
    expect(client.get).toHaveBeenCalledWith(path, {
      updated_after: '2026-11-03T19:00:00.000Z',
      per_page: 100,
      page: 1,
    });
  });

  it('reads the commits of a ref up to a limit', async () => {
    client.get.mockResolvedValueOnce(respond(200, [{ id: 'bbb' }]));
    client.get.mockResolvedValueOnce(respond(404, { message: 'Not Found' }));

    expect(await repository.findCommits(3, 'bbb', 2)).toEqual([{ id: 'bbb' }]);
    expect(await repository.findCommits(3, 'gone', 2)).toEqual([]);
    expect(client.get).toHaveBeenCalledWith('/projects/3/repository/commits', {
      ref_name: 'bbb',
      per_page: 2,
    });
  });

  it.each([401, 403, 400])('rejects without retries on status %i', async (status) => {
    client.get.mockResolvedValue(respond(status, { message: 'denied' }));

    const error = await catchError(repository.findUser(7), GitLabRejectedError);

    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(error.status).toBe(status);
    expect(error.message).toBe(`GitLab API error: /users/7: ${status}`);
  });

  it('reads Retry-After in seconds on 429', async () => {
    client.get.mockResolvedValue(respond(429, {}, { 'retry-after': '30' }));

    const error = await catchError(repository.findUser(7), GitLabRetryableError);

    expect(error.retryAfterSeconds).toBe(30);
  });

  it('ignores a Retry-After that is not a number of seconds', async () => {
    client.get.mockResolvedValue(
      respond(429, {}, { 'retry-after': 'Wed, 04 Nov 2026 12:00:00 GMT' }),
    );

    const error = await catchError(repository.findUser(7), GitLabRetryableError);

    expect(error.retryAfterSeconds).toBeNull();
  });

  it('retries a server error', async () => {
    client.get.mockResolvedValue(respond(502, '<html>Bad Gateway</html>'));

    const error = await catchError(repository.findUser(7), GitLabRetryableError);

    expect(error.message).toContain('502');
  });

  it('retries a response that is not JSON', async () => {
    client.get.mockResolvedValue(respond(200, '<html>Sign in</html>'));

    const error = await catchError(repository.findUser(7), GitLabRetryableError);

    expect(error.message).toContain('GitLab returned an invalid response');
  });
});
