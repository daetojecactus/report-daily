import { describe, expect, it, vi } from 'vitest';
import { GitLabIssuable, GitLabState } from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabEvent,
  GitLabIssue,
  GitLabMergeRequest,
  GitLabNote,
  GitLabProject,
  GitLabPushData,
  GitLabStateEvent,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import type { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import { Source } from '../../source.enums';
import { GitLabSourceDetails } from '../gitlab-source.details';
import type { SourceHiddenItems } from '../gitlab-source.interface';
import { GitLabSourceKeys } from '../gitlab-source.keys';
import type { GitLabSourceScanner } from '../gitlab-source.scanner';
import { GitLabSourceService } from '../gitlab-source.service';
import {
  createBuilder,
  createEvent,
  createIssue,
  createMergeRequest,
  createNote,
  createProject,
  createStateEvent,
  PROJECT_ID,
  REPORT_DATE,
} from './gitlab-source.fixture';

const GITLAB_USER_ID = 501;

interface GitLabData {
  events: GitLabEvent[];
  projects?: GitLabProject[];
  issues?: GitLabIssue[];
  mergeRequests?: GitLabMergeRequest[];
  closingIssues?: Record<number, GitLabIssue[]>;
  notes?: Record<string, GitLabNote[]>;
  stateEvents?: Record<string, GitLabStateEvent[]>;
}

function findItem<T extends { project_id: number; iid: number }>(
  items: T[] | undefined,
  projectId: number,
  iid: number,
) {
  return items?.find((item) => item.project_id === projectId && item.iid === iid) ?? null;
}

function createGitLab(data: GitLabData) {
  const toKey = (issuable: GitLabIssuable, projectId: number, iid: number) =>
    `${issuable}:${projectId}:${iid}`;
  return {
    findUserEventsAround: vi.fn(() => Promise.resolve(data.events)),
    findProject: vi.fn((id: number) =>
      Promise.resolve(
        (data.projects ?? [createProject()]).find((project) => project.id === id) ?? null,
      ),
    ),
    findIssue: vi.fn((projectId: number, iid: number) =>
      Promise.resolve(findItem(data.issues, projectId, iid)),
    ),
    findMergeRequest: vi.fn((projectId: number, iid: number) =>
      Promise.resolve(findItem(data.mergeRequests, projectId, iid)),
    ),
    findMergeRequestByBranch: vi.fn((projectId: number, branch: string) =>
      Promise.resolve(
        data.mergeRequests?.find(
          (mergeRequest) =>
            mergeRequest.project_id === projectId && mergeRequest.source_branch === branch,
        ) ?? null,
      ),
    ),
    findIssuesClosedOnMerge: vi.fn((_projectId: number, iid: number) =>
      Promise.resolve(data.closingIssues?.[iid] ?? []),
    ),
    findNotes: vi.fn((issuable: GitLabIssuable, projectId: number, iid: number) =>
      Promise.resolve(data.notes?.[toKey(issuable, projectId, iid)] ?? []),
    ),
    findLabelEvents: vi.fn(() => Promise.resolve([])),
    findStateEvents: vi.fn((issuable: GitLabIssuable, projectId: number, iid: number) =>
      Promise.resolve(data.stateEvents?.[toKey(issuable, projectId, iid)] ?? []),
    ),
    findMergeRequestCommits: vi.fn(() => Promise.resolve([])),
    findPushCommits: vi.fn((_projectId: number, push: GitLabPushData) =>
      Promise.resolve([{ id: push.commit_to ?? '', title: 'fix: a bug', created_at: '' }]),
    ),
  };
}

function collect(
  gitlab: ReturnType<typeof createGitLab>,
  timeZone = 'UTC',
  hidden: SourceHiddenItems = { issues: [], mergeRequests: [] },
) {
  const scanner = { findHiddenItems: vi.fn(() => Promise.resolve(hidden)) };
  const keys = new GitLabSourceKeys();
  return new GitLabSourceService(
    gitlab as unknown as GitLabService,
    createBuilder(),
    scanner as unknown as GitLabSourceScanner,
    new GitLabSourceDetails(gitlab as unknown as GitLabService, keys),
    keys,
  ).collect(
    {
      id: '0190b5a8-0000-7000-8000-000000000003',
      userId: '0190b5a8-0000-7000-8000-000000000001',
      source: Source.GITLAB,
      externalId: String(GITLAB_USER_ID),
      username: 'qa.user',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    REPORT_DATE,
    timeZone,
  );
}

function issueEvent(iid: number, overrides: Partial<GitLabEvent> = {}) {
  return createEvent({
    action_name: 'opened',
    target_type: 'Issue',
    target_iid: iid,
    ...overrides,
  });
}

function commentEvent(targetType: string, noteableType: string, iid: number) {
  return createEvent({
    action_name: 'commented on',
    target_type: targetType,
    target_iid: 900,
    note: { body: 'a comment', noteable_type: noteableType, noteable_iid: iid },
  });
}

function pushEvent(branch: string) {
  return createEvent({
    action_name: 'pushed to',
    target_type: null,
    push_data: {
      action: 'pushed',
      ref_type: 'branch',
      ref: branch,
      commit_count: 1,
      commit_from: 'aaa',
      commit_to: 'bbb',
      commit_title: 'fix: a bug',
    },
  });
}

describe('GitLabSourceService', () => {
  it('keeps only the events of the day in the time zone of the employee', async () => {
    const gitlab = createGitLab({
      events: [
        issueEvent(12, { created_at: '2026-08-01T20:00:00.000Z' }),
        issueEvent(13, { created_at: '2026-08-02T20:00:00.000Z' }),
      ],
      issues: [createIssue({ iid: 12 }), createIssue({ iid: 13 })],
    });

    const grouped = await collect(gitlab, 'Asia/Almaty');

    expect(gitlab.findUserEventsAround).toHaveBeenCalledWith(GITLAB_USER_ID, REPORT_DATE);
    expect(grouped.issues.map((issue) => issue.iid)).toEqual([12]);
    expect(gitlab.findIssue).toHaveBeenCalledTimes(1);
  });

  it('groups work items and comments of every type under their item', async () => {
    const gitlab = createGitLab({
      events: [
        issueEvent(12, { target_type: 'WorkItem' }),
        commentEvent('Note', 'Issue', 12),
        commentEvent('DiscussionNote', 'Issue', 12),
        commentEvent('DiscussionNote', 'WorkItem', 12),
        commentEvent('DiffNote', 'MergeRequest', 5),
      ],
      issues: [createIssue({ iid: 12 })],
      mergeRequests: [createMergeRequest({ iid: 5 })],
    });

    const grouped = await collect(gitlab);

    expect(grouped.issues).toHaveLength(1);
    expect(grouped.issues[0].events).toHaveLength(4);
    expect(grouped.standaloneMergeRequests).toHaveLength(1);
    expect(grouped.standaloneMergeRequests[0].events[0].noteBody).toBe('a comment');
    expect(gitlab.findIssue).toHaveBeenCalledTimes(1);
  });

  it('links a merge request to the issue of its branch and loads that issue', async () => {
    const gitlab = createGitLab({
      events: [
        createEvent({
          action_name: 'opened',
          target_type: 'MergeRequest',
          target_iid: 5,
        }),
      ],
      issues: [createIssue({ iid: 12 })],
      mergeRequests: [createMergeRequest({ iid: 5, source_branch: '12-login' })],
    });

    const grouped = await collect(gitlab);

    expect(gitlab.findIssue).toHaveBeenCalledWith(PROJECT_ID, 12);
    expect(grouped.issues).toHaveLength(1);
    expect(grouped.issues[0].mergeRequests.map((item) => item.iid)).toEqual([5]);
    expect(grouped.standaloneMergeRequests).toEqual([]);
  });

  it('keeps a merge request alone when its branch names no issue it can load', async () => {
    const gitlab = createGitLab({
      events: [
        createEvent({ target_type: 'MergeRequest', target_iid: 5 }),
        createEvent({ target_type: 'MergeRequest', target_iid: 6 }),
      ],
      mergeRequests: [
        createMergeRequest({ iid: 5, source_branch: '99-gone' }),
        createMergeRequest({ iid: 6, source_branch: 'feature/x' }),
      ],
    });

    const grouped = await collect(gitlab);

    expect(grouped.issues).toEqual([]);
    expect(grouped.standaloneMergeRequests.map((mergeRequest) => mergeRequest.iid)).toEqual([5, 6]);
  });

  it('finds the merge request of a pushed branch and moves the pushes into it', async () => {
    const gitlab = createGitLab({
      events: [pushEvent('12-login')],
      issues: [createIssue({ iid: 12 })],
      mergeRequests: [createMergeRequest({ iid: 5, source_branch: '12-login' })],
    });

    const grouped = await collect(gitlab);

    expect(gitlab.findMergeRequestByBranch).toHaveBeenCalledWith(PROJECT_ID, '12-login');
    const [mergeRequest] = grouped.issues[0].mergeRequests;
    expect(mergeRequest.iid).toBe(5);
    expect(mergeRequest.events.map((event) => event.actionName)).toEqual(['pushed to']);
    expect(grouped.standalonePushes).toEqual([]);
  });

  it('keeps pushes to a work branch and marks pushes to the main branches', async () => {
    const gitlab = createGitLab({
      events: [
        pushEvent('experiment'),
        pushEvent('main'),
        pushEvent('develop'),
        pushEvent('release'),
      ],
      projects: [createProject({ default_branch: 'release' })],
    });

    const grouped = await collect(gitlab);

    expect(gitlab.findMergeRequestByBranch).toHaveBeenCalledTimes(1);
    expect(grouped.standalonePushes.map(({ branch, mainBranch }) => [branch, mainBranch])).toEqual([
      ['experiment', false],
      ['main', true],
      ['develop', true],
      ['release', true],
    ]);
  });

  it('leaves out the push that GitLab writes when it merges a merge request', async () => {
    const toMain = (id: number, commit: string) =>
      createEvent({
        id,
        action_name: 'pushed to',
        push_data: {
          action: 'pushed',
          ref_type: 'branch',
          ref: 'main',
          commit_count: 1,
          commit_from: 'aaa',
          commit_to: commit,
          commit_title: 'a commit',
        },
      });
    const gitlab = createGitLab({
      events: [
        createEvent({ action_name: 'accepted', target_type: 'MergeRequest', target_iid: 5 }),
        toMain(2, 'merge-sha'),
        toMain(3, 'direct-sha'),
      ],
      mergeRequests: [createMergeRequest({ iid: 5, merge_commit_sha: 'merge-sha' })],
    });

    const grouped = await collect(gitlab);

    expect(
      grouped.standalonePushes.map(({ branch, events }) => [branch, events.map(({ id }) => id)]),
    ).toEqual([['main', [3]]]);
  });

  it('puts a push to an issue branch without a merge request into that issue', async () => {
    const gitlab = createGitLab({
      events: [issueEvent(12), pushEvent('12-spike')],
      issues: [createIssue({ iid: 12 })],
    });

    const grouped = await collect(gitlab);

    expect(grouped.issues.map((issue) => issue.pushes.map((push) => push.branch))).toEqual([
      ['12-spike'],
    ]);
    expect(grouped.issues[0].pushes[0].events.map((event) => event.actionName)).toEqual([
      'pushed to',
    ]);
    expect(grouped.standalonePushes).toEqual([]);
  });

  it('loads the issue of a pushed branch that is not in the day', async () => {
    const gitlab = createGitLab({
      events: [pushEvent('12-spike')],
      issues: [createIssue({ iid: 12 })],
    });

    const grouped = await collect(gitlab);

    expect(gitlab.findIssue).toHaveBeenCalledWith(PROJECT_ID, 12);
    expect(grouped.issues.map((issue) => [issue.iid, issue.pushes.length])).toEqual([[12, 1]]);
    expect(grouped.standalonePushes).toEqual([]);
  });

  it('keeps a push alone when its branch names no issue it can load', async () => {
    const gitlab = createGitLab({ events: [pushEvent('77-spike')] });

    const grouped = await collect(gitlab);

    expect(grouped.issues).toEqual([]);
    expect(grouped.standalonePushes.map((push) => push.branch)).toEqual(['77-spike']);
  });

  it('skips issues and merge requests GitLab does not have', async () => {
    const gitlab = createGitLab({
      events: [issueEvent(12), createEvent({ target_type: 'MergeRequest', target_iid: 5 })],
    });

    const grouped = await collect(gitlab);

    expect(grouped.issues).toEqual([]);
    expect(grouped.standaloneMergeRequests).toEqual([]);
    expect(gitlab.findNotes).not.toHaveBeenCalled();
  });

  it('ignores events without a project and comments on commits', async () => {
    const gitlab = createGitLab({
      events: [
        issueEvent(12, { project_id: null }),
        commentEvent('Note', 'Commit', 0),
        createEvent({ action_name: 'joined', target_type: null }),
      ],
    });

    const grouped = await collect(gitlab);

    expect(gitlab.findProject).not.toHaveBeenCalled();
    expect(grouped).toEqual({
      projects: [],
      issues: [],
      standaloneMergeRequests: [],
      standalonePushes: [],
    });
  });

  it('loads the comments and state events of issues and merge requests', async () => {
    const gitlab = createGitLab({
      events: [
        issueEvent(12, { action_name: 'closed' }),
        createEvent({ target_type: 'MergeRequest', target_iid: 5 }),
      ],
      issues: [createIssue({ iid: 12, state: GitLabState.CLOSED })],
      mergeRequests: [createMergeRequest({ iid: 5, source_branch: '12-login' })],
      notes: {
        [`merge_requests:${PROJECT_ID}:5`]: [
          createNote({ body: 'requested review from @qa.user' }),
        ],
      },
      stateEvents: {
        [`issues:${PROJECT_ID}:12`]: [
          createStateEvent(GitLabState.CLOSED, `${REPORT_DATE}T16:00:00.000Z`),
        ],
      },
    });

    const grouped = await collect(gitlab);

    expect(gitlab.findNotes).toHaveBeenCalledWith(GitLabIssuable.ISSUES, PROJECT_ID, 12);
    expect(gitlab.findMergeRequestCommits).toHaveBeenCalledWith(PROJECT_ID, 5);
    expect(grouped.projects.map((project) => project.name)).toEqual(['backend']);
    expect(grouped.issues[0]).toMatchObject({
      state: GitLabState.CLOSED,
      closedOnReportDate: true,
    });
    expect(grouped.issues[0].mergeRequests[0].reviewers).toEqual(['qa.user']);
  });

  it('keeps a merge request that closes several issues alone with their list', async () => {
    const gitlab = createGitLab({
      events: [createEvent({ target_type: 'MergeRequest', target_iid: 5 })],
      mergeRequests: [createMergeRequest({ iid: 5, source_branch: 'release' })],
      closingIssues: {
        5: [createIssue({ iid: 12 }), createIssue({ iid: 30, project_id: 2 })],
      },
    });

    const grouped = await collect(gitlab);

    expect(gitlab.findIssue).not.toHaveBeenCalled();
    expect(grouped.issues).toEqual([]);
    expect(
      grouped.standaloneMergeRequests[0].closesIssues.map((issue) => [issue.projectId, issue.iid]),
    ).toEqual([
      [PROJECT_ID, 12],
      [2, 30],
    ]);
  });

  it('puts a merge request without a number in its branch under the only issue it closes', async () => {
    const gitlab = createGitLab({
      events: [createEvent({ target_type: 'MergeRequest', target_iid: 5 })],
      projects: [createProject(), createProject({ id: 2, name: 'frontend' })],
      mergeRequests: [createMergeRequest({ iid: 5, source_branch: 'fix/x' })],
      closingIssues: { 5: [createIssue({ iid: 30, project_id: 2 })] },
    });

    const grouped = await collect(gitlab);

    expect(gitlab.findIssue).not.toHaveBeenCalled();
    expect(
      grouped.issues.map((issue) => [
        issue.projectId,
        issue.iid,
        issue.mergeRequests.map((mergeRequest) => mergeRequest.iid),
      ]),
    ).toEqual([[2, 30, [5]]]);
    expect(grouped.standaloneMergeRequests).toEqual([]);
    expect(grouped.projects.map((project) => project.name)).toEqual(['backend', 'frontend']);
  });

  it('puts a merge request under the issue of its branch and lists the issues it closes', async () => {
    const gitlab = createGitLab({
      events: [createEvent({ target_type: 'MergeRequest', target_iid: 5 })],
      issues: [createIssue({ iid: 12 })],
      mergeRequests: [createMergeRequest({ iid: 5, source_branch: '12-login' })],
      closingIssues: {
        5: [createIssue({ iid: 12 }), createIssue({ iid: 13 })],
      },
    });

    const grouped = await collect(gitlab);

    expect(gitlab.findIssue).not.toHaveBeenCalled();
    expect(grouped.issues.map((issue) => issue.iid)).toEqual([12]);
    expect(grouped.issues[0].mergeRequests[0].closesIssues.map((issue) => issue.iid)).toEqual([
      12, 13,
    ]);
  });

  it('loads the commits of every push of the day', async () => {
    const gitlab = createGitLab({
      events: [pushEvent('12-login'), pushEvent('experiment')],
      issues: [createIssue({ iid: 12 })],
      mergeRequests: [createMergeRequest({ iid: 5, source_branch: '12-login' })],
    });

    const grouped = await collect(gitlab);

    expect(gitlab.findPushCommits).toHaveBeenCalledTimes(2);
    expect(gitlab.findPushCommits).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({ ref: '12-login', commit_to: 'bbb' }),
    );
    const [push] = grouped.issues[0].mergeRequests[0].events;
    expect(push.pushData?.commits).toEqual([{ id: 'bbb', title: 'fix: a bug' }]);
    expect(grouped.standalonePushes[0].events[0].pushData?.commits).toEqual([
      { id: 'bbb', title: 'fix: a bug' },
    ]);
  });

  it('collects the actions of the employee by the GitLab id', async () => {
    const gitlab = createGitLab({
      events: [issueEvent(12)],
      issues: [createIssue({ iid: 12 })],
      notes: {
        [`issues:${PROJECT_ID}:12`]: [
          createNote({
            body: 'changed the description',
            author: {
              id: GITLAB_USER_ID,
              username: 'renamed',
              name: 'Renamed',
            },
          }),
        ],
      },
    });

    const grouped = await collect(gitlab);

    expect(grouped.issues[0].facts.filter((fact) => fact.own).map((fact) => fact.kind)).toEqual([
      'description_changed',
    ]);
  });

  it('adds the items changed without events to the day', async () => {
    const gitlab = createGitLab({
      events: [issueEvent(12)],
      issues: [createIssue({ iid: 12 }), createIssue({ iid: 30 })],
      mergeRequests: [createMergeRequest({ iid: 7, source_branch: 'docs' })],
      notes: {
        [`issues:${PROJECT_ID}:30`]: [
          createNote({
            body: 'changed the description',
            author: { id: GITLAB_USER_ID, username: 'qa.user', name: 'QA' },
          }),
        ],
      },
    });

    const grouped = await collect(gitlab, 'UTC', {
      issues: [
        { projectId: PROJECT_ID, iid: 12 },
        { projectId: PROJECT_ID, iid: 30 },
      ],
      mergeRequests: [{ projectId: PROJECT_ID, iid: 7 }],
    });

    expect(grouped.issues.map((issue) => [issue.iid, issue.events.length])).toEqual([
      [12, 1],
      [30, 0],
    ]);
    expect(grouped.issues[1].facts.filter((fact) => fact.own).map((fact) => fact.kind)).toEqual([
      'description_changed',
    ]);
    expect(grouped.standaloneMergeRequests.map((item) => item.iid)).toEqual([7]);
    expect(gitlab.findIssue).toHaveBeenCalledTimes(2);
  });
});
