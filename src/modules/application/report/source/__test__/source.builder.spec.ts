import { describe, expect, it } from 'vitest';
import { getDayRange } from 'src/common/utils/date.util';
import {
  GitLabLabelAction,
  GitLabState,
} from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabMergeRequest,
  GitLabNote,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import { SourceBuilder } from '../source.builder';
import type { IssueActivity, MergeRequestActivity } from '../source.interface';
import {
  createAuthor,
  createCommit,
  createEvent,
  createIssue,
  createLabelEvent,
  createMergeRequest,
  createNote,
  createProject,
  createStateEvent,
  REPORT_DATE,
} from './source.fixture';

const DAY = getDayRange(REPORT_DATE, 'UTC');
const USERNAME = 'qa.user';

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
    commits: [],
    ...overrides,
  };
}

function buildMergeRequest(
  mergeRequest: GitLabMergeRequest,
  overrides: Partial<MergeRequestActivity> = {},
) {
  const [grouped] = new SourceBuilder().build(
    {
      projects: [],
      issues: [],
      mergeRequests: [toActivity(mergeRequest, overrides)],
      pushes: [],
    },
    DAY,
  ).standaloneMergeRequests;
  return grouped;
}

function buildIssue(overrides: Partial<IssueActivity> = {}) {
  const [grouped] = new SourceBuilder().build(
    {
      projects: [],
      issues: [
        {
          issue: createIssue(),
          events: [],
          notes: [],
          labelEvents: [],
          stateEvents: [],
          mergeRequests: [],
          ...overrides,
        },
      ],
      mergeRequests: [],
      pushes: [],
    },
    DAY,
  ).issues;
  return grouped;
}

function withNotes(notes: GitLabNote[]) {
  return { notes };
}

describe('SourceBuilder', () => {
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
        withNotes([
          createNote({ body: `please review @${USERNAME}`, system: false }),
        ]),
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
      expect(
        buildIssue({ issue: createIssue({ state: GitLabState.CLOSED }) }),
      ).toMatchObject({ state: GitLabState.CLOSED, closedOnReportDate: false });
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
          createStateEvent(
            GitLabState.REOPENED,
            `${REPORT_DATE}T09:00:00.000Z`,
          ),
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
        stateEvents: [
          createStateEvent(GitLabState.MERGED, '2026-08-03T09:00:00.000Z'),
        ],
      });

      expect(grouped).toMatchObject({
        state: GitLabState.OPENED,
        mergedOnReportDate: false,
      });
    });

    it('marks a merge request merged on the report day', () => {
      const grouped = buildMergeRequest(createMergeRequest(), {
        stateEvents: [
          createStateEvent(GitLabState.MERGED, `${REPORT_DATE}T17:00:00.000Z`),
        ],
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

  it('nests merge requests in their issue and cleans pushes and projects', () => {
    const push = createEvent({
      id: 7,
      action_name: 'pushed to',
      push_data: {
        action: 'pushed',
        ref_type: 'branch',
        ref: 'hotfix',
        commit_count: 2,
        commit_title: 'fix: the cache',
      },
    });

    const grouped = new SourceBuilder().build(
      {
        projects: [createProject()],
        issues: [
          {
            issue: createIssue(),
            events: [],
            notes: [],
            labelEvents: [],
            stateEvents: [],
            mergeRequests: [
              toActivity(createMergeRequest({ source_branch: '12-login' }), {
                closingIssues: [createIssue(), createIssue({ iid: 13 })],
              }),
            ],
          },
        ],
        mergeRequests: [],
        pushes: [
          { target: { projectId: 1, branch: 'hotfix' }, events: [push] },
        ],
      },
      DAY,
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
        branch: 'hotfix',
        events: [
          {
            id: 7,
            projectId: 1,
            actionName: 'pushed to',
            targetType: null,
            targetTitle: null,
            createdAt: `${REPORT_DATE}T10:00:00.000Z`,
            pushData: {
              commitCount: 2,
              action: 'pushed',
              refType: 'branch',
              ref: 'hotfix',
              commitTitle: 'fix: the cache',
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
          systemNote(
            `assigned to @${USERNAME}`,
            `${REPORT_DATE}T09:00:00.000Z`,
          ),
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
        withNotes([
          systemNote(
            'assigned to @dev.c, @dev.d and @dev.e and unassigned @dev.f',
          ),
        ]),
      );

      expect(grouped.assignees).toEqual(['dev.f']);
    });

    it('keeps the reviewers of the day and everyone asked before its end', () => {
      const grouped = buildMergeRequest(
        createMergeRequest({ reviewers: [createAuthor('dev.late')] }),
        withNotes([
          systemNote(
            `requested review from @${USERNAME}`,
            `${REPORT_DATE}T10:00:00.000Z`,
          ),
          systemNote(
            `requested review from @dev.late and removed review request for @${USERNAME}`,
          ),
        ]),
      );

      expect(grouped.reviewers).toEqual([USERNAME]);
    });

    it.each([
      [false, 'ready', true],
      [true, 'draft', false],
    ])(
      'restores the draft flag %s after a later mark as %s',
      (isDraftNow, mark, isDraftThen) => {
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
      },
    );

    it('keeps the draft flag without later marks', () => {
      const grouped = buildMergeRequest(
        createMergeRequest({ draft: true }),
        withNotes([
          systemNote(
            'marked this merge request as **draft**',
            `${REPORT_DATE}T09:00:00.000Z`,
          ),
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
});
