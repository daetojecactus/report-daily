import { Logger } from '@nestjs/common';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getDayRange } from 'src/common/utils/date.util';
import {
  GitLabLabelAction,
  GitLabRefType,
  GitLabState,
} from 'src/modules/vendors/gitlab/gitlab.enums';
import type { GitLabMergeRequest, GitLabNote } from 'src/modules/vendors/gitlab/gitlab.interface';
import { ItemState, SourceActionKind, SourceRefType } from '../../source.enums';
import { GitLabSourceMessages } from '../constants/gitlab-source.messages';
import type {
  IssueActivity,
  MergeRequestActivity,
  SourcePlanHistory,
} from '../gitlab-source.interface';
import type { SourceFact } from '../../source.interface';
import {
  createAuthor,
  createBuilder,
  createCommit,
  createEvent,
  createIssue,
  createLabelEvent,
  createMergeRequest,
  createNote,
  createProject,
  createStateEvent,
  createWeightEvent,
  REPORT_DATE,
} from './gitlab-source.fixture';

const DAY = getDayRange(REPORT_DATE, 'UTC');
const USERNAME = 'qa.user';
const EMPLOYEE = createAuthor(USERNAME);
const NO_PLANS: SourcePlanHistory = { current: null, events: [] };

function toActivity(
  mergeRequest: GitLabMergeRequest,
  overrides: Partial<MergeRequestActivity> = {},
): MergeRequestActivity {
  return {
    mergeRequest,
    closingIssues: [],
    events: [],
    notes: [],
    labelEvents: [],
    stateEvents: [],
    milestones: NO_PLANS,
    commits: [],
    ...overrides,
  };
}

function buildMergeRequest(
  mergeRequest: GitLabMergeRequest,
  overrides: Partial<MergeRequestActivity> = {},
) {
  const [grouped] = createBuilder().build(
    {
      projects: [],
      issues: [],
      mergeRequests: [toActivity(mergeRequest, overrides)],
      pushes: [],
      directPushes: [],
      refs: [],
      targets: [],
      pushCommits: new Map(),
    },
    DAY,
    { id: EMPLOYEE.id, username: USERNAME },
  ).standaloneMergeRequests;
  return grouped;
}

function buildIssue(overrides: Partial<IssueActivity> = {}) {
  const [grouped] = createBuilder().build(
    {
      projects: [],
      issues: [
        {
          issue: createIssue(),
          events: [],
          notes: [],
          labelEvents: [],
          stateEvents: [],
          milestones: NO_PLANS,
          iterations: NO_PLANS,
          weightEvents: [],
          mergeRequests: [],
          pushes: [],
          ...overrides,
        },
      ],
      mergeRequests: [],
      pushes: [],
      directPushes: [],
      refs: [],
      targets: [],
      pushCommits: new Map(),
    },
    DAY,
    { id: EMPLOYEE.id, username: USERNAME },
  ).issues;
  return grouped;
}

function withNotes(notes: GitLabNote[]) {
  return { notes };
}

describe('GitLabSourceBuilder', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  describe('merge request reviewers', () => {
    it('keeps the current reviewers', () => {
      const grouped = buildMergeRequest(
        createMergeRequest({ reviewers: [createAuthor(USERNAME)] }),
      );

      expect(grouped.reviewers).toContain(USERNAME);
    });

    it('keeps a reviewer who removed themselves, by the review request note', () => {
      const grouped = buildMergeRequest(
        createMergeRequest({ reviewers: [] }),
        withNotes([createNote({ body: `requested review from @${USERNAME}` })]),
      );

      expect(grouped.reviewers).toEqual([USERNAME]);
    });

    it('reads several reviewers from one note', () => {
      const grouped = buildMergeRequest(
        createMergeRequest({ reviewers: [] }),
        withNotes([
          createNote({
            body: `requested review from @${USERNAME} and @dev.two`,
          }),
        ]),
      );

      expect(grouped.reviewers).toEqual([USERNAME, 'dev.two']);
    });

    it('does not make a reviewer of someone mentioned in a comment', () => {
      const grouped = buildMergeRequest(
        createMergeRequest({ reviewers: [] }),
        withNotes([createNote({ body: `please review @${USERNAME}`, system: false })]),
      );

      expect(grouped.reviewers).toEqual([]);
    });

    it('counts review threads over all comments, not only the report day', () => {
      const grouped = buildMergeRequest(
        createMergeRequest(),
        withNotes([
          createNote({
            id: 1,
            body: 'a remark two days ago',
            system: false,
            resolvable: true,
            resolved: true,
            created_at: '2026-07-31T10:00:00.000Z',
          }),
          createNote({
            id: 2,
            body: 'one more remark',
            system: false,
            resolvable: true,
            resolved: false,
            created_at: '2026-07-31T11:00:00.000Z',
          }),
        ]),
      );

      expect(grouped.reviewThreads).toEqual({ total: 2, unresolved: 1 });
    });
  });

  describe('state at the end of the day', () => {
    it('keeps the current state without state events', () => {
      expect(buildIssue({ issue: createIssue({ state: GitLabState.CLOSED }) })).toMatchObject({
        state: GitLabState.CLOSED,
        closedOnReportDate: false,
      });
    });

    it('takes the last state of the day, not the current one', () => {
      const grouped = buildIssue({
        issue: createIssue({ state: GitLabState.OPENED }),
        stateEvents: [
          createStateEvent(GitLabState.REOPENED, '2026-08-03T09:00:00.000Z'),
          createStateEvent(GitLabState.CLOSED, `${REPORT_DATE}T15:00:00.000Z`),
        ],
      });

      expect(grouped).toMatchObject({
        state: GitLabState.CLOSED,
        closedOnReportDate: true,
      });
    });

    it('reads a reopened issue as opened', () => {
      const grouped = buildIssue({
        issue: createIssue({ state: GitLabState.CLOSED }),
        stateEvents: [
          createStateEvent(GitLabState.CLOSED, '2026-07-30T09:00:00.000Z'),
          createStateEvent(GitLabState.REOPENED, `${REPORT_DATE}T09:00:00.000Z`),
          createStateEvent(GitLabState.CLOSED, '2026-08-04T09:00:00.000Z'),
        ],
      });

      expect(grouped).toMatchObject({
        state: GitLabState.OPENED,
        closedOnReportDate: false,
      });
    });

    it('treats an item with state events only after the day as opened', () => {
      const grouped = buildMergeRequest(createMergeRequest(), {
        stateEvents: [createStateEvent(GitLabState.MERGED, '2026-08-03T09:00:00.000Z')],
      });

      expect(grouped).toMatchObject({
        state: GitLabState.OPENED,
        mergedOnReportDate: false,
      });
    });

    it('marks a merge request merged on the report day', () => {
      const grouped = buildMergeRequest(createMergeRequest(), {
        stateEvents: [createStateEvent(GitLabState.MERGED, `${REPORT_DATE}T17:00:00.000Z`)],
      });

      expect(grouped).toMatchObject({
        state: GitLabState.MERGED,
        mergedOnReportDate: true,
      });
    });
  });

  it('takes the last commit before the report day', () => {
    const grouped = buildMergeRequest(createMergeRequest(), {
      commits: [
        createCommit('2026-07-25T10:00:00.000Z'),
        createCommit('2026-08-01T22:00:00.000Z'),
        createCommit(`${REPORT_DATE}T10:00:00.000Z`),
      ],
    });

    expect(grouped.lastCommitAt).toBe('2026-08-01T22:00:00.000Z');
  });

  it('has no last commit when every commit is of the report day', () => {
    const grouped = buildMergeRequest(createMergeRequest(), {
      commits: [createCommit(`${REPORT_DATE}T10:00:00.000Z`)],
    });

    expect(grouped.lastCommitAt).toBeNull();
  });

  it('keeps the comments and label events of the report day only', () => {
    const grouped = buildIssue({
      notes: [
        createNote({ id: 1, created_at: '2026-08-01T10:00:00.000Z' }),
        createNote({
          id: 2,
          body: 'done',
          system: false,
          noteable_type: 'Issue',
          author: createAuthor(USERNAME),
        }),
      ],
      labelEvents: [
        createLabelEvent({ id: 1, created_at: '2026-08-03T10:00:00.000Z' }),
        createLabelEvent({ id: 2, label: null }),
        createLabelEvent({ id: 3, action: GitLabLabelAction.REMOVE }),
      ],
    });

    expect(grouped.notes).toEqual([
      {
        id: 2,
        body: 'done',
        authorUsername: USERNAME,
        authorName: USERNAME,
        createdAt: `${REPORT_DATE}T10:00:00.000Z`,
        system: false,
        noteableType: 'Issue',
        resolvable: false,
        resolved: undefined,
      },
    ]);
    expect(grouped.labelEvents).toEqual([
      {
        id: 3,
        labelName: 'status::doing',
        action: GitLabLabelAction.REMOVE,
        createdAt: `${REPORT_DATE}T11:00:00.000Z`,
        username: 'dev.author',
      },
    ]);
  });

  it('builds a tag as a push without a merge request', () => {
    const tag = createEvent({
      id: 8,
      action_name: 'pushed new',
      push_data: {
        action: 'created',
        ref_type: GitLabRefType.TAG,
        ref: 'v1.4.0',
        ref_count: null,
        commit_count: 0,
        commit_from: null,
        commit_to: 'ccc',
        commit_title: null,
      },
    });

    const grouped = createBuilder().build(
      {
        projects: [],
        issues: [],
        mergeRequests: [],
        pushes: [],
        directPushes: [],
        refs: [
          { target: { projectId: 1, ref: 'v1.4.0', refType: SourceRefType.TAG }, events: [tag] },
        ],
        targets: [],
        pushCommits: new Map(),
      },
      DAY,
      { id: EMPLOYEE.id, username: USERNAME },
    );

    expect(
      grouped.standalonePushes.map(({ ref, refType, mainBranch, events }) => [
        ref,
        refType,
        mainBranch,
        events.map((event) => event.pushData?.refType),
      ]),
    ).toEqual([['v1.4.0', SourceRefType.TAG, false, [SourceRefType.TAG]]]);
  });

  it('nests merge requests in their issue and cleans pushes and projects', () => {
    const push = createEvent({
      id: 7,
      action_name: 'pushed to',
      push_data: {
        action: 'pushed',
        ref_type: GitLabRefType.BRANCH,
        ref_count: null,
        ref: 'hotfix',
        commit_count: 1,
        commit_from: 'aaa',
        commit_to: 'bbb',
        commit_title: 'fix: the cache',
      },
    });

    const grouped = createBuilder().build(
      {
        projects: [createProject()],
        issues: [
          {
            issue: createIssue(),
            events: [],
            notes: [],
            labelEvents: [],
            stateEvents: [],
            milestones: NO_PLANS,
            iterations: NO_PLANS,
            weightEvents: [],
            pushes: [],
            mergeRequests: [
              toActivity(createMergeRequest({ source_branch: '12-login' }), {
                closingIssues: [createIssue(), createIssue({ iid: 13 })],
              }),
            ],
          },
        ],
        mergeRequests: [],
        pushes: [{ target: { projectId: 1, branch: 'hotfix' }, events: [push] }],
        directPushes: [],
        refs: [],
        targets: [],
        pushCommits: new Map([
          [7, [createCommit(`${REPORT_DATE}T09:00:00.000Z`, 'fix: the cache')]],
        ]),
      },
      DAY,
      { id: EMPLOYEE.id, username: USERNAME },
    );

    expect(grouped.projects).toEqual([
      {
        id: 1,
        name: 'backend',
        path: 'team/backend',
        webUrl: 'https://gitlab.example.com/team/backend',
      },
    ]);
    expect(grouped.issues[0].mergeRequests[0]).toMatchObject({
      sourceBranch: '12-login',
      closesIssues: [
        {
          projectId: 1,
          iid: 12,
          title: 'Fix the login',
          webUrl: 'https://gitlab.example.com/team/backend/-/issues/12',
        },
        {
          projectId: 1,
          iid: 13,
          title: 'Fix the login',
          webUrl: 'https://gitlab.example.com/team/backend/-/issues/12',
        },
      ],
    });
    expect(grouped.standaloneMergeRequests).toEqual([]);
    expect(grouped.standalonePushes).toEqual([
      {
        projectId: 1,
        ref: 'hotfix',
        refType: SourceRefType.BRANCH,
        mainBranch: false,
        events: [
          {
            id: 7,
            projectId: 1,
            actionName: 'pushed to',
            targetType: null,
            targetTitle: null,
            createdAt: `${REPORT_DATE}T10:00:00.000Z`,
            pushData: {
              commitCount: 1,
              action: 'pushed',
              refType: SourceRefType.BRANCH,
              ref: 'hotfix',
              refCount: null,
              commitTitle: 'fix: the cache',
              commits: [{ id: `${REPORT_DATE}T09:00:00.000Z`, title: 'fix: the cache' }],
            },
            noteBody: undefined,
          },
        ],
      },
    ]);
  });
  describe('values at the end of the day', () => {
    const AFTER_THE_DAY = '2026-08-03T09:00:00.000Z';

    function systemNote(body: string, createdAt = AFTER_THE_DAY) {
      return createNote({ body, created_at: createdAt });
    }

    it('undoes the label events after the day', () => {
      const grouped = buildIssue({
        issue: createIssue({ labels: ['status::done', 'priority::high'] }),
        labelEvents: [
          createLabelEvent({ label: { name: 'status::review' } }),
          createLabelEvent({
            label: { name: 'status::review' },
            action: GitLabLabelAction.REMOVE,
            created_at: AFTER_THE_DAY,
          }),
          createLabelEvent({
            label: { name: 'status::done' },
            created_at: '2026-08-03T10:00:00.000Z',
          }),
          createLabelEvent({ label: null, created_at: AFTER_THE_DAY }),
        ],
      });

      expect(grouped.labels).toEqual(['priority::high', 'status::review']);
    });

    it('undoes the assignments after the day', () => {
      const grouped = buildIssue({
        issue: createIssue({
          assignees: [createAuthor('dev.two'), createAuthor('dev.three')],
        }),
        notes: [
          systemNote(`assigned to @${USERNAME}`, `${REPORT_DATE}T09:00:00.000Z`),
          systemNote(`assigned to @dev.two and unassigned @${USERNAME}`),
          systemNote('assigned to @dev.three', '2026-08-04T09:00:00.000Z'),
        ],
      });

      expect(grouped.assignees).toEqual([USERNAME]);
    });

    it('reads several users on both sides of one note', () => {
      const grouped = buildMergeRequest(
        createMergeRequest({
          assignees: ['dev.c', 'dev.d', 'dev.e'].map(createAuthor),
        }),
        withNotes([systemNote('assigned to @dev.c, @dev.d and @dev.e and unassigned @dev.f')]),
      );

      expect(grouped.assignees).toEqual(['dev.f']);
    });

    it('keeps the reviewers of the day and everyone asked before its end', () => {
      const grouped = buildMergeRequest(
        createMergeRequest({ reviewers: [createAuthor('dev.late')] }),
        withNotes([
          systemNote(`requested review from @${USERNAME}`, `${REPORT_DATE}T10:00:00.000Z`),
          systemNote(`requested review from @dev.late and removed review request for @${USERNAME}`),
        ]),
      );

      expect(grouped.reviewers).toEqual([USERNAME]);
    });

    it.each([
      [false, 'ready', true],
      [true, 'draft', false],
    ])('restores the draft flag %s after a later mark as %s', (isDraftNow, mark, isDraftThen) => {
      const grouped = buildMergeRequest(
        createMergeRequest({ draft: isDraftNow }),
        withNotes([
          systemNote(`marked this merge request as **${mark}**`),
          systemNote(
            `marked this merge request as **${isDraftNow ? 'ready' : 'draft'}**`,
            '2026-08-04T09:00:00.000Z',
          ),
        ]),
      );

      expect(grouped.draft).toBe(isDraftThen);
    });

    it('keeps the draft flag without later marks', () => {
      const grouped = buildMergeRequest(
        createMergeRequest({ draft: true }),
        withNotes([
          systemNote('marked this merge request as **draft**', `${REPORT_DATE}T09:00:00.000Z`),
        ]),
      );

      expect(grouped.draft).toBe(true);
    });

    it('counts the review threads as they were at the end of the day', () => {
      const thread = (overrides: Partial<GitLabNote>) =>
        createNote({ system: false, resolvable: true, ...overrides });

      const grouped = buildMergeRequest(
        createMergeRequest(),
        withNotes([
          thread({
            id: 1,
            resolved: true,
            resolved_at: `${REPORT_DATE}T12:00:00.000Z`,
          }),
          thread({ id: 2, resolved: true, resolved_at: AFTER_THE_DAY }),
          thread({ id: 3, resolved: false }),
          thread({ id: 4, resolved: false, created_at: AFTER_THE_DAY }),
        ]),
      );

      expect(grouped.reviewThreads).toEqual({ total: 3, unresolved: 2 });
    });
  });
  describe('facts of the day', () => {
    const OTHER = createAuthor('dev.other');

    function ownNote(body: string, hour: number, system = true) {
      return createNote({
        id: hour,
        body,
        system,
        author: EMPLOYEE,
        created_at: `${REPORT_DATE}T${String(hour).padStart(2, '0')}:00:00.000Z`,
      });
    }

    function action(
      kind: SourceActionKind,
      hour: number,
      value: string | null = null,
      users: string[] = [],
    ) {
      return {
        kind,
        at: `${REPORT_DATE}T${String(hour).padStart(2, '0')}:00:00.000Z`,
        value,
        users,
      };
    }

    function toOwn(facts: SourceFact[]) {
      return facts
        .filter((fact) => fact.own)
        .map(({ kind, at, value, users }) => ({ kind, at, value, users }));
    }

    it('reads a commit mention in the same and in another project', () => {
      const grouped = buildIssue({
        notes: [
          ownNote('mentioned in commit abc1234f', 9),
          ownNote('mentioned in commit group/backend@def5678a', 10),
        ],
      });

      expect(toOwn(grouped.facts)).toEqual([
        action(SourceActionKind.COMMIT_MENTIONED, 9, 'abc1234f'),
        action(SourceActionKind.COMMIT_MENTIONED, 10, 'def5678a'),
      ]);
    });

    it('keeps a link on the issue where it was made and marks the replies on the others', () => {
      const note = (id: number, body: string, second: number, author = EMPLOYEE) =>
        createNote({
          id,
          body,
          system: true,
          author,
          created_at: `${REPORT_DATE}T10:00:${String(second).padStart(2, '0')}.000Z`,
        });
      const issue = (iid: number, notes: GitLabNote[]): IssueActivity => ({
        issue: createIssue({ iid }),
        events: [],
        notes,
        labelEvents: [],
        stateEvents: [],
        milestones: NO_PLANS,
        iterations: NO_PLANS,
        weightEvents: [],
        mergeRequests: [],
        pushes: [],
      });
      const grouped = createBuilder().build(
        {
          projects: [],
          issues: [
            issue(1, [
              note(12, 'marked this issue as related to #2 and #3', 1),
              note(21, 'marked this issue as blocking #4', 30),
              note(22, 'marked this issue as related to #5', 31),
            ]),
            issue(2, [note(10, 'marked this issue as related to #1', 0)]),
            issue(3, [note(11, 'marked this issue as related to #1', 0)]),
            issue(4, [note(20, 'marked this issue as blocked by #1', 30)]),
            issue(5, [note(13, 'marked this issue as related to #9', 1, OTHER)]),
          ],
          mergeRequests: [],
          pushes: [],
          directPushes: [],
          refs: [],
          targets: [],
          pushCommits: new Map(),
        },
        DAY,
        { id: EMPLOYEE.id, username: USERNAME },
      );

      expect(grouped.issues.map(({ iid, facts }) => [iid, facts.map(({ kind }) => kind)])).toEqual([
        [1, [SourceActionKind.LINKED, SourceActionKind.LINKED, SourceActionKind.LINKED]],
        [2, [SourceActionKind.RECIPROCAL_LINK]],
        [3, [SourceActionKind.RECIPROCAL_LINK]],
        [4, [SourceActionKind.RECIPROCAL_LINK]],
        [5, [SourceActionKind.LINKED]],
      ]);
    });

    it('reads links, hierarchy, moves and duplicates of issues', () => {
      const grouped = buildIssue({
        notes: [
          ownNote('marked this issue as related to #45', 8),
          ownNote('marked as related to #46', 9),
          ownNote('marked this item as blocking team/backend#47', 10),
          ownNote('marked this issue as blocked by #48 and #49', 11),
          ownNote('added #50 as parent item', 12),
          ownNote('added #51 as child task', 13),
          ownNote('removed the relation with #45', 14),
          ownNote('moved from team/frontend#3', 15),
          ownNote('marked this issue as a duplicate of #52', 16),
          ownNote('marked #53 as a duplicate of this issue', 17),
          ownNote('cloned to team/backend#9', 18),
        ],
      });

      expect(toOwn(grouped.facts)).toEqual([
        action(SourceActionKind.LINKED, 8, 'related to'),
        action(SourceActionKind.LINKED, 9, 'related to'),
        action(SourceActionKind.LINKED, 10, 'blocking'),
        action(SourceActionKind.LINKED, 11, 'blocked by'),
        action(SourceActionKind.LINKED, 12, 'parent'),
        action(SourceActionKind.CHILD_ADDED, 13),
        action(SourceActionKind.UNLINKED, 14),
        action(SourceActionKind.MOVED_IN, 15, 'team/frontend#3'),
        action(SourceActionKind.DUPLICATE_MARKED, 16),
        action(SourceActionKind.LINKED, 17, 'duplicate'),
      ]);
    });

    it('logs only the system notes it neither reads nor knows, by their shape', () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const grouped = buildIssue({
        notes: [
          ownNote('added 2 commits\n\n* abc1234 - fix', 9),
          ownNote('mentioned in merge request !15', 10),
          ownNote('changed target branch from `develop` to `main`', 11),
          ownNote('made the item visible to everyone', 11),
          ownNote('marked the checklist item **Проверить оплату** as completed', 12),
          ownNote('changed time estimate to 2h', 13),
          ownNote('changed the incident severity to **Высокая**', 14),
          ownNote('promoted to epic &5', 15),
        ],
      });

      expect(grouped.facts).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenNthCalledWith(
        1,
        { noteableType: 'MergeRequest', shape: 'changed the incident severity to **x**' },
        GitLabSourceMessages.UNKNOWN_NOTE,
      );
      expect(warn).toHaveBeenNthCalledWith(
        2,
        { noteableType: 'MergeRequest', shape: 'promoted to epic REF' },
        GitLabSourceMessages.UNKNOWN_NOTE,
      );
      warn.mockRestore();
    });

    it('reads auto-merge, requested changes and a changed file without logging the known notes', () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const grouped = buildMergeRequest(createMergeRequest(), {
        notes: [
          ownNote('enabled an automatic merge when all merge checks for abc12345 pass', 9),
          ownNote('canceled the automatic merge', 10),
          ownNote('requested changes', 11),
          ownNote(
            'changed this file in [version 2 of the diff](/team/backend/-/merge_requests/5/diffs)',
            12,
          ),
          ownNote('aborted the automatic merge because the source branch was updated', 13),
          ownNote(
            'deleted the `develop` branch. This merge request now targets the `main` branch',
            14,
          ),
        ],
      });

      expect(toOwn(grouped.facts)).toEqual([
        action(SourceActionKind.AUTO_MERGE_SET, 9),
        action(SourceActionKind.AUTO_MERGE_CANCELED, 10),
        action(SourceActionKind.CHANGES_REQUESTED, 11),
        action(SourceActionKind.DIFF_LINE_CHANGED, 12),
      ]);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('reads due and start dates, also both in one note', () => {
      const grouped = buildIssue({
        notes: [
          ownNote('changed due date to November 15, 2026', 9),
          ownNote(
            'changed start date to November 2, 2026 and changed due date to November 20, 2026',
            10,
          ),
          ownNote('removed due date November 20, 2026', 11),
          ownNote('removed start date November 2, 2026', 12),
        ],
      });

      expect(toOwn(grouped.facts)).toEqual([
        action(SourceActionKind.DUE_DATE_SET, 9, 'November 15, 2026'),
        action(SourceActionKind.START_DATE_SET, 10, 'November 2, 2026'),
        action(SourceActionKind.DUE_DATE_SET, 10, 'November 20, 2026'),
        action(SourceActionKind.DUE_DATE_REMOVED, 11, 'November 20, 2026'),
        action(SourceActionKind.START_DATE_REMOVED, 12, 'November 2, 2026'),
      ]);
    });

    it('sums the time the employee spent on the day by its spent at date', () => {
      const grouped = buildIssue({
        notes: [
          ownNote(`added 1h 30m of time spent at ${REPORT_DATE} 10:00:00 +0000`, 11),
          ownNote(`added 1d of time spent at ${REPORT_DATE} 12:00:00 +0000`, 12),
          ownNote(`deleted 30m of spent time from ${REPORT_DATE} 10:00:00 +0000`, 13),
          ownNote('added 2h of time spent at 2026-08-01 10:00:00 +0000', 14),
          createNote({
            body: `added 5h of time spent at ${REPORT_DATE} 10:00:00 +0000`,
            system: true,
            author: OTHER,
            created_at: `${REPORT_DATE}T15:00:00.000Z`,
          }),
        ],
      });

      expect(grouped.timeSpent).toBe(9 * 60 * 60);
      expect(grouped.facts).toEqual([]);
    });

    it('collects what the employee did on an issue in time order', () => {
      const grouped = buildIssue({
        issue: createIssue({
          author: EMPLOYEE,
          created_at: `${REPORT_DATE}T08:00:00.000Z`,
        }),
        notes: [
          ownNote('looks good', 9, false),
          ownNote('set status to **In progress**', 10),
          ownNote('assigned to @dev.other and unassigned @qa.user', 12),
          ownNote('changed the description', 13),
          ownNote(
            '<p>changed title from <code class="idiff">a</code> to <code class="idiff">b</code></p>',
            14,
          ),
          ownNote(
            'created branch [`12-login`](/team/backend/-/compare/main...12-login) to address this issue',
            15,
          ),
          ownNote('moved to team/frontend#3', 16),
          createNote({ body: 'changed the description', author: OTHER }),
          createNote({
            body: 'changed the description',
            author: EMPLOYEE,
            created_at: '2026-08-01T10:00:00.000Z',
          }),
        ],
        labelEvents: [
          createLabelEvent({
            user: EMPLOYEE,
            label: { name: 'status::doing' },
            created_at: `${REPORT_DATE}T11:00:00.000Z`,
          }),
          createLabelEvent({
            user: EMPLOYEE,
            label: { name: 'status::todo' },
            action: GitLabLabelAction.REMOVE,
            created_at: `${REPORT_DATE}T11:00:00.000Z`,
          }),
          createLabelEvent({ user: OTHER }),
          createLabelEvent({ user: EMPLOYEE, label: null }),
        ],
        stateEvents: [
          {
            ...createStateEvent(GitLabState.CLOSED, `${REPORT_DATE}T17:00:00.000Z`),
            user: EMPLOYEE,
          },
          {
            ...createStateEvent(GitLabState.REOPENED, `${REPORT_DATE}T18:00:00.000Z`),
            user: OTHER,
          },
        ],
      });

      expect(toOwn(grouped.facts)).toEqual([
        action(SourceActionKind.OPENED, 8),
        action(SourceActionKind.COMMENTED, 9),
        action(SourceActionKind.STATUS_SET, 10, 'In progress'),
        action(SourceActionKind.LABEL_ADDED, 11, 'status::doing'),
        action(SourceActionKind.LABEL_REMOVED, 11, 'status::todo'),
        action(SourceActionKind.ASSIGNED, 12, null, ['dev.other']),
        action(SourceActionKind.UNASSIGNED, 12, null, [USERNAME]),
        action(SourceActionKind.DESCRIPTION_CHANGED, 13),
        action(SourceActionKind.TITLE_CHANGED, 14),
        action(SourceActionKind.BRANCH_CREATED, 15, '12-login'),
        action(SourceActionKind.MOVED_OUT, 16, 'team/frontend#3'),
        action(SourceActionKind.CLOSED, 17),
      ]);
    });

    it('collects what the employee did on a merge request', () => {
      const grouped = buildMergeRequest(createMergeRequest({ author: OTHER }), {
        notes: [
          ownNote('requested review from @dev.a and removed review request for @dev.b', 9),
          ownNote('approved this merge request', 10),
          ownNote('unapproved this merge request', 11),
          ownNote('marked this merge request as **draft**', 12),
          ownNote('marked this merge request as **ready**', 13),
          ownNote('resolved all threads', 14),
          ownNote(
            'changed this line in [version 2 of the diff](/team/backend/-/merge_requests/5/diffs)',
            15,
          ),
          ownNote('left review comments', 16),
        ],
        stateEvents: [
          {
            ...createStateEvent(GitLabState.MERGED, `${REPORT_DATE}T17:00:00.000Z`),
            user: EMPLOYEE,
          },
        ],
      });

      expect(toOwn(grouped.facts)).toEqual([
        action(SourceActionKind.REVIEW_REQUESTED, 9, null, ['dev.a']),
        action(SourceActionKind.REVIEW_REQUEST_REMOVED, 9, null, ['dev.b']),
        action(SourceActionKind.APPROVED, 10),
        action(SourceActionKind.UNAPPROVED, 11),
        action(SourceActionKind.MARKED_DRAFT, 12),
        action(SourceActionKind.MARKED_READY, 13),
        action(SourceActionKind.THREADS_RESOLVED, 14),
        action(SourceActionKind.DIFF_LINE_CHANGED, 15),
        action(SourceActionKind.REVIEW_SUBMITTED, 16),
        action(SourceActionKind.MERGED, 17),
      ]);
    });

    it('keeps what others did with the actor and marks the employee by id', () => {
      const grouped = buildIssue({
        issue: createIssue({ author: OTHER, created_at: `${REPORT_DATE}T08:00:00.000Z` }),
        notes: [
          createNote({ body: 'please check', author: OTHER, system: false }),
          createNote({
            body: 'approved this merge request',
            author: { ...EMPLOYEE, username: 'renamed.user' },
            created_at: `${REPORT_DATE}T12:00:00.000Z`,
          }),
        ],
        labelEvents: [createLabelEvent({ user: OTHER, label: { name: 'status::review' } })],
        stateEvents: [
          { ...createStateEvent(GitLabState.CLOSED, `${REPORT_DATE}T17:00:00.000Z`), user: null },
        ],
      });

      expect(grouped.facts.map(({ kind, actor, own }) => ({ kind, actor, own }))).toEqual(
        expect.arrayContaining([
          { kind: SourceActionKind.OPENED, actor: 'dev.other', own: false },
          { kind: SourceActionKind.COMMENTED, actor: 'dev.other', own: false },
          { kind: SourceActionKind.LABEL_ADDED, actor: 'dev.other', own: false },
          { kind: SourceActionKind.APPROVED, actor: 'renamed.user', own: true },
          { kind: SourceActionKind.CLOSED, actor: null, own: false },
        ]),
      );
      expect(grouped.facts).toHaveLength(5);
    });

    it('makes the employee pushes facts of the merge request', () => {
      const grouped = buildMergeRequest(createMergeRequest(), {
        events: [
          createEvent({
            action_name: 'pushed to',
            created_at: `${REPORT_DATE}T11:00:00.000Z`,
            push_data: {
              commit_count: 2,
              action: 'pushed',
              ref_type: GitLabRefType.BRANCH,
              ref_count: null,
              ref: '12-login',
              commit_from: 'aaa',
              commit_to: 'bbb',
              commit_title: 'fix: the login',
            },
          }),
        ],
      });

      expect(grouped.facts.filter((fact) => fact.kind === SourceActionKind.PUSHED)).toEqual([
        {
          kind: SourceActionKind.PUSHED,
          at: `${REPORT_DATE}T11:00:00.000Z`,
          actor: USERNAME,
          own: true,
          value: '12-login',
          users: [],
        },
      ]);
    });

    it.each([
      [
        'the last status set before the end of the day',
        [
          ['set status to **To do**', '2026-08-01T10:00:00.000Z'],
          ['set status to **In progress**', `${REPORT_DATE}T10:00:00.000Z`],
          ['set status to **Done**', '2026-08-03T10:00:00.000Z'],
        ],
        'In progress',
      ],
      ['no status without status notes', [], null],
    ])('restores %s', (_name, notes, status) => {
      const grouped = buildIssue({
        notes: notes.map(([body, createdAt]) => createNote({ body, created_at: createdAt })),
      });

      expect(grouped.status).toBe(status);
    });
  });

  describe('state at the start of the day', () => {
    it('undoes what happened during the day for an issue', () => {
      const grouped = buildIssue({
        issue: createIssue({
          state: GitLabState.CLOSED,
          labels: ['status::done'],
          assignees: [createAuthor('dev.b')],
        }),
        labelEvents: [
          createLabelEvent({
            label: { name: 'status::done' },
            created_at: `${REPORT_DATE}T15:00:00.000Z`,
          }),
          createLabelEvent({
            label: { name: 'status::review' },
            action: GitLabLabelAction.REMOVE,
            created_at: `${REPORT_DATE}T15:00:00.000Z`,
          }),
        ],
        stateEvents: [createStateEvent(GitLabState.CLOSED, `${REPORT_DATE}T16:00:00.000Z`)],
        notes: [
          createNote({
            body: 'assigned to @dev.b and unassigned @dev.a',
            created_at: `${REPORT_DATE}T14:00:00.000Z`,
          }),
          createNote({
            body: 'set status to **In progress**',
            created_at: '2026-08-01T10:00:00.000Z',
          }),
          createNote({
            body: 'set status to **Done**',
            created_at: `${REPORT_DATE}T16:00:00.000Z`,
          }),
        ],
      });

      expect(grouped.startOfDay).toEqual({
        state: ItemState.OPENED,
        labels: ['status::review'],
        assignees: ['dev.a'],
        status: 'In progress',
        milestone: null,
        iteration: null,
        weight: null,
      });
      expect(grouped.state).toBe(ItemState.CLOSED);
    });

    it('restores the weight and makes facts of its changes', () => {
      const grouped = buildIssue({
        issue: createIssue({ weight: null }),
        weightEvents: [
          createWeightEvent({ weight: 2, created_at: '2026-07-20T10:00:00.000Z' }),
          createWeightEvent({
            user: EMPLOYEE,
            weight: 5,
            created_at: `${REPORT_DATE}T10:00:00.000Z`,
          }),
          createWeightEvent({
            user: EMPLOYEE,
            weight: null,
            created_at: `${REPORT_DATE}T12:00:00.000Z`,
          }),
        ],
      });
      const unchanged = buildIssue({ issue: createIssue({ weight: 8 }) });

      expect([grouped.startOfDay.weight, grouped.weight]).toEqual([2, null]);
      expect([unchanged.startOfDay.weight, unchanged.weight]).toEqual([8, 8]);
      expect(grouped.facts.map(({ kind, value, own }) => [kind, value, own])).toEqual([
        [SourceActionKind.WEIGHT_SET, '5', true],
        [SourceActionKind.WEIGHT_REMOVED, '5', true],
      ]);
    });

    it('restores the iteration and the milestone and makes facts of their changes', () => {
      const plan = (
        name: string,
        action: GitLabLabelAction,
        created_at: string,
        user = EMPLOYEE,
      ) => ({ name, action, created_at, user });
      const grouped = buildIssue({
        iterations: {
          current: 'sprint 3',
          events: [
            plan('sprint 2', GitLabLabelAction.ADD, '2026-07-20T10:00:00.000Z', createAuthor('pm')),
            plan('sprint 3', GitLabLabelAction.ADD, `${REPORT_DATE}T10:00:00.000Z`),
          ],
        },
        milestones: {
          current: null,
          events: [
            plan('17.5', GitLabLabelAction.ADD, `${REPORT_DATE}T09:00:00.000Z`),
            plan('17.5', GitLabLabelAction.REMOVE, `${REPORT_DATE}T11:00:00.000Z`),
          ],
        },
      });

      expect([grouped.startOfDay.iteration, grouped.iteration]).toEqual(['sprint 2', 'sprint 3']);
      expect([grouped.startOfDay.milestone, grouped.milestone]).toEqual([null, null]);
      expect(grouped.facts.map(({ kind, value, own }) => [kind, value, own])).toEqual([
        [SourceActionKind.MILESTONE_SET, '17.5', true],
        [SourceActionKind.ITERATION_SET, 'sprint 3', true],
        [SourceActionKind.MILESTONE_REMOVED, '17.5', true],
      ]);
    });

    it('keeps the current plan without events and the removed one before its first removal', () => {
      const grouped = buildIssue({
        iterations: { current: 'sprint 3', events: [] },
        milestones: {
          current: null,
          events: [
            {
              name: '17.5',
              action: GitLabLabelAction.REMOVE,
              created_at: `${REPORT_DATE}T11:00:00.000Z`,
              user: createAuthor('pm'),
            },
          ],
        },
      });

      expect([grouped.startOfDay.iteration, grouped.iteration]).toEqual(['sprint 3', 'sprint 3']);
      expect([grouped.startOfDay.milestone, grouped.milestone]).toEqual(['17.5', null]);
      expect(grouped.facts.map(({ kind, own }) => [kind, own])).toEqual([
        [SourceActionKind.MILESTONE_REMOVED, false],
      ]);
    });

    it('keeps the reviewers and the draft of a merge request at the start of the day', () => {
      const grouped = buildMergeRequest(
        createMergeRequest({ reviewers: [createAuthor('dev.r')], draft: false }),
        {
          notes: [
            createNote({
              body: 'requested review from @dev.r',
              created_at: `${REPORT_DATE}T10:00:00.000Z`,
            }),
            createNote({
              body: 'marked this merge request as **ready**',
              created_at: `${REPORT_DATE}T09:00:00.000Z`,
            }),
          ],
        },
      );

      expect(grouped.startOfDay).toMatchObject({ reviewers: [], draft: true, status: null });
      expect(grouped.reviewers).toEqual(['dev.r']);
    });
  });
});
