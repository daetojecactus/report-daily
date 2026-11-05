import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitLabIssuable } from '../gitlab.enums';
import type { GitLabPushData } from '../gitlab.interface';
import type { GitLabRepository } from '../gitlab.repository';
import { GitLabService } from '../gitlab.service';

describe('GitLabService', () => {
  const repository = {
    searchUsers: vi.fn(),
    findUser: vi.fn(),
    findLastUserEvent: vi.fn(),
    findUserEvents: vi.fn(),
    findProject: vi.fn(),
    findIssue: vi.fn(),
    findMergeRequest: vi.fn(),
    findMergeRequestByBranch: vi.fn(),
    findIssuesClosedOnMerge: vi.fn(),
    findUpdatedItems: vi.fn(),
    findNotes: vi.fn(),
    findLabelEvents: vi.fn(),
    findStateEvents: vi.fn(),
    findMergeRequestCommits: vi.fn(),
    findCommits: vi.fn(),
  };
  const service = new GitLabService(repository as unknown as GitLabRepository);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    [{ id: 1 }, true],
    [null, false],
  ])(
    'reports visible activity for the last event %j',
    async (event, isVisible) => {
      repository.findLastUserEvent.mockResolvedValue(event);

      expect(await service.hasVisibleActivity(7)).toBe(isVisible);
      expect(repository.findLastUserEvent).toHaveBeenCalledWith(7);
    },
  );

  function push(overrides: Partial<GitLabPushData> = {}): GitLabPushData {
    return {
      action: 'pushed',
      ref_type: 'branch',
      ref: '12-login',
      commit_count: 2,
      commit_from: 'aaa',
      commit_to: 'ccc',
      commit_title: 'feat: c',
      ...overrides,
    };
  }

  it('finds the commits of a push from the oldest to the newest', async () => {
    repository.findCommits.mockResolvedValue([
      { id: 'ccc' },
      { id: 'bbb' },
      { id: 'aaa' },
    ]);

    expect(await service.findPushCommits(3, push())).toEqual([
      { id: 'bbb' },
      { id: 'ccc' },
    ]);
    expect(repository.findCommits).toHaveBeenCalledWith(3, 'ccc', 2);
  });

  it('takes the commits of a new branch up to the count', async () => {
    repository.findCommits.mockResolvedValue([{ id: 'ccc' }, { id: 'bbb' }]);

    expect(
      await service.findPushCommits(3, push({ commit_from: null })),
    ).toEqual([{ id: 'bbb' }, { id: 'ccc' }]);
  });

  it('asks for at most one page of commits', async () => {
    repository.findCommits.mockResolvedValue([]);

    await service.findPushCommits(3, push({ commit_count: 250 }));

    expect(repository.findCommits).toHaveBeenCalledWith(3, 'ccc', 100);
  });

  it.each([
    ['a removed branch', { commit_to: null, commit_count: 0 }],
    ['a push without commits', { commit_count: 0 }],
  ])('finds no commits for %s', async (_name, overrides) => {
    expect(await service.findPushCommits(3, push(overrides))).toEqual([]);
    expect(repository.findCommits).not.toHaveBeenCalled();
  });

  it('finds the projects of the user events over the last days', async () => {
    repository.findUserEvents.mockResolvedValue([
      { project_id: 3 },
      { project_id: null },
      { project_id: 4 },
      { project_id: 3 },
    ]);

    expect(await service.findRecentProjectIds(7, '2026-11-05', 30)).toEqual([
      3, 4,
    ]);
    expect(repository.findUserEvents).toHaveBeenCalledWith(
      7,
      '2026-10-06',
      '2026-11-07',
    );
  });

  it('asks for the events from two days before to two days after the date', async () => {
    const events = [{ id: 1 }];
    repository.findUserEvents.mockResolvedValue(events);

    expect(await service.findUserEventsAround(7, '2026-11-01')).toBe(events);
    expect(repository.findUserEvents).toHaveBeenCalledWith(
      7,
      '2026-10-30',
      '2026-11-03',
    );
  });

  it.each([
    ['searchUsers', () => service.searchUsers('ann'), ['ann']],
    ['findUser', () => service.findUser(7), [7]],
    ['findProject', () => service.findProject(3), [3]],
    ['findIssue', () => service.findIssue(3, 12), [3, 12]],
    ['findMergeRequest', () => service.findMergeRequest(3, 5), [3, 5]],
    [
      'findMergeRequestByBranch',
      () => service.findMergeRequestByBranch(3, '12-login'),
      [3, '12-login'],
    ],
    [
      'findIssuesClosedOnMerge',
      () => service.findIssuesClosedOnMerge(3, 5),
      [3, 5],
    ],
    [
      'findUpdatedItems',
      () =>
        service.findUpdatedItems(
          GitLabIssuable.ISSUES,
          3,
          '2026-11-03T19:00:00.000Z',
        ),
      [GitLabIssuable.ISSUES, 3, '2026-11-03T19:00:00.000Z'],
    ],
    [
      'findNotes',
      () => service.findNotes(GitLabIssuable.ISSUES, 3, 12),
      [GitLabIssuable.ISSUES, 3, 12],
    ],
    [
      'findLabelEvents',
      () => service.findLabelEvents(GitLabIssuable.ISSUES, 3, 12),
      [GitLabIssuable.ISSUES, 3, 12],
    ],
    [
      'findStateEvents',
      () => service.findStateEvents(GitLabIssuable.MERGE_REQUESTS, 3, 5),
      [GitLabIssuable.MERGE_REQUESTS, 3, 5],
    ],
    [
      'findMergeRequestCommits',
      () => service.findMergeRequestCommits(3, 5),
      [3, 5],
    ],
  ] as const)('passes %s to the repository', async (method, call, args) => {
    const result = { found: method };
    repository[method].mockResolvedValue(result);

    expect(await call()).toBe(result);
    expect(repository[method]).toHaveBeenCalledWith(...args);
  });
});
