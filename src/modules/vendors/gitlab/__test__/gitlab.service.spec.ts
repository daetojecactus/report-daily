import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitLabIssuable } from '../gitlab.enums';
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
    findNotes: vi.fn(),
    findLabelEvents: vi.fn(),
    findStateEvents: vi.fn(),
    findMergeRequestCommits: vi.fn(),
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
