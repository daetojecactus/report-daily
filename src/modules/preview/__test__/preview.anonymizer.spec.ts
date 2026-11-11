import { describe, expect, it } from 'vitest';
import {
  ItemState,
  LabelAction,
  SourceActionKind,
  SourceRefType,
  SourceTargetType,
  WorkItemType,
} from 'src/modules/application/source/types/source.enums';
import type { CleanNote } from 'src/modules/application/source/types/source.interface';
import type {
  GroupedDailyData,
  GroupedMergeRequest,
} from 'src/modules/application/source/types/source-day.interface';
import { PreviewAnonymizer } from '../preview.anonymizer';

const SECRETS = [
  'anna.petrova',
  'Анна Петрова',
  'ivan.sidorov',
  'acme-corp',
  'acme.example.org',
  'billing-api',
  'Починить оплату картой',
  'Fix card payments in checkout',
  'region::EU',
  'app::server',
  'fix-card-payments',
  'acme-packages',
  'Custom review',
  'mentioned in acme-corp/billing-api',
  'Поправил верстку',
  'fix the checkout layout',
  'a1b2c3d4',
  'Новый заголовок',
];

function createNote(body: string, overrides: Partial<CleanNote> = {}): CleanNote {
  return {
    id: 1,
    body,
    authorUsername: 'anna.petrova',
    authorName: 'Анна Петрова',
    createdAt: '2026-11-05T09:00:00.000Z',
    system: true,
    noteableType: 'MergeRequest',
    resolvable: false,
    ...overrides,
  };
}

function createMergeRequest(overrides: Partial<GroupedMergeRequest> = {}): GroupedMergeRequest {
  return {
    projectId: 501,
    iid: 7,
    title: 'Fix card payments in checkout',
    state: ItemState.OPENED,
    mergedOnReportDate: false,
    draft: false,
    webUrl: 'https://acme.example.org/acme-corp/billing-api/-/merge_requests/7',
    sourceBranch: '12-fix-card-payments',
    labels: ['status::review', 'app::server'],
    createdAt: '2026-11-04T09:00:00.000Z',
    lastCommitAt: null,
    author: 'anna.petrova',
    assignees: ['anna.petrova'],
    reviewers: ['ivan.sidorov'],
    closesIssues: [
      {
        projectId: 502,
        iid: 3,
        title: 'Починить оплату картой',
        webUrl: 'https://acme.example.org/acme-corp/billing-api/-/issues/3',
      },
    ],
    milestone: 'Acme Q4',
    timeSpent: 1800,
    startOfDay: {
      state: ItemState.OPENED,
      labels: ['status::doing', 'region::EU'],
      assignees: ['anna.petrova'],
      status: null,
      milestone: 'Acme Q3',
      reviewers: ['ivan.sidorov'],
      draft: true,
    },
    facts: [
      {
        kind: SourceActionKind.REVIEW_REQUESTED,
        at: '2026-11-05T09:00:00.000Z',
        actor: 'anna.petrova',
        own: true,
        value: null,
        users: ['ivan.sidorov'],
      },
    ],
    events: [
      {
        id: 10,
        projectId: 501,
        actionName: 'pushed to',
        targetType: null,
        targetTitle: null,
        createdAt: '2026-11-05T08:00:00.000Z',
        pushData: {
          commitCount: 3,
          action: 'pushed',
          refType: SourceRefType.BRANCH,
          ref: '12-fix-card-payments',
          refCount: null,
          commitTitle: 'fix the checkout layout',
          commits: [
            { id: 'a1b2c3d4', title: 'fix the checkout layout' },
            { id: 'e5f6', title: 'add e2e tests for checkout' },
            { id: 'a7b8', title: 'Поправил тесты оплаты' },
          ],
        },
      },
      {
        id: 11,
        projectId: 501,
        actionName: 'commented on',
        targetType: 'MergeRequest',
        targetTitle: 'Fix card payments in checkout',
        createdAt: '2026-11-05T08:30:00.000Z',
        noteBody: 'Поправил верстку',
      },
    ],
    notes: [
      createNote('Поправил верстку', { system: false, resolvable: true, resolved: false }),
      createNote('approved this merge request', { authorUsername: 'ivan.sidorov' }),
      createNote('requested review from @ivan.sidorov and unassigned @anna.petrova'),
      createNote('set status to **Custom review**'),
      createNote('set status to **In progress**'),
      createNote('created branch [`12-fix-card-payments`](https://acme.example.org/x)'),
      createNote('changed title from **Fix card payments** to **Новый заголовок**'),
      createNote('changed the description'),
      createNote('mentioned in acme-corp/billing-api!9'),
    ],
    labelEvents: [
      {
        id: 20,
        labelName: 'region::EU',
        action: LabelAction.ADD,
        createdAt: '2026-11-05T08:00:00.000Z',
        username: 'anna.petrova',
      },
      {
        id: 21,
        labelName: 'Status::Ready_for QA',
        action: LabelAction.ADD,
        createdAt: '2026-11-05T08:00:00.000Z',
        username: 'anna.petrova',
      },
    ],
    reviewThreads: { total: 1, unresolved: 1 },
    ...overrides,
  };
}

function createDay(): GroupedDailyData {
  return {
    projects: [
      {
        id: 501,
        name: 'billing-api',
        path: 'acme-corp/billing-api',
        webUrl: 'https://acme.example.org/acme-corp/billing-api',
      },
    ],
    issues: [
      {
        projectId: 501,
        iid: 12,
        title: 'Починить оплату картой',
        state: ItemState.OPENED,
        closedOnReportDate: false,
        webUrl: 'https://acme.example.org/acme-corp/billing-api/-/issues/12',
        workItemType: WorkItemType.INCIDENT,
        labels: ['type::bug', 'region::EU'],
        createdAt: '2026-11-01T09:00:00.000Z',
        assignees: ['anna.petrova', 'ivan.sidorov'],
        status: 'Custom review',
        milestone: 'Acme Q4',
        iteration: 'Acme sprint 47',
        weight: 5,
        timeSpent: 5400,
        startOfDay: {
          state: ItemState.OPENED,
          labels: ['type::bug', 'region::EU'],
          assignees: ['anna.petrova'],
          status: 'Custom review',
          milestone: null,
          iteration: 'Acme sprint 46',
          weight: 3,
        },
        facts: [
          {
            kind: SourceActionKind.LABEL_ADDED,
            at: '2026-11-05T08:00:00.000Z',
            value: 'app::server',
            actor: 'anna.petrova',
            own: true,
            users: [],
          },
          {
            kind: SourceActionKind.BRANCH_CREATED,
            at: '2026-11-05T08:00:00.000Z',
            value: '12-fix-card-payments',
            actor: 'anna.petrova',
            own: true,
            users: [],
          },
          {
            kind: SourceActionKind.STATUS_SET,
            at: '2026-11-05T08:00:00.000Z',
            value: 'Done',
            actor: 'anna.petrova',
            own: true,
            users: [],
          },
          {
            kind: SourceActionKind.COMMIT_MENTIONED,
            at: '2026-11-05T08:10:00.000Z',
            value: 'a1b2c3d',
            actor: 'anna.petrova',
            own: true,
            users: [],
          },
          {
            kind: SourceActionKind.WEIGHT_SET,
            at: '2026-11-05T08:30:00.000Z',
            value: '5',
            actor: 'anna.petrova',
            own: true,
            users: [],
          },
          {
            kind: SourceActionKind.ITERATION_SET,
            at: '2026-11-05T09:00:00.000Z',
            value: 'Acme sprint 47',
            actor: 'anna.petrova',
            own: true,
            users: [],
          },
        ],
        events: [],
        notes: [],
        labelEvents: [],
        mergeRequests: [createMergeRequest()],
        pushes: [
          {
            projectId: 501,
            ref: '12-fix-card-payments',
            refType: SourceRefType.BRANCH,
            mainBranch: false,
            events: [],
          },
        ],
      },
    ],
    standaloneMergeRequests: [
      createMergeRequest({
        iid: 8,
        sourceBranch: 'renovate-bot/acme-packages',
        labels: ['type::maintenance'],
      }),
    ],
    standalonePushes: [
      {
        projectId: 501,
        ref: 'main',
        refType: SourceRefType.BRANCH,
        mainBranch: true,
        events: [],
      },
      {
        projectId: 501,
        ref: 'acme-2.3',
        refType: SourceRefType.TAG,
        mainBranch: false,
        events: [],
      },
      {
        projectId: 501,
        ref: 'acme-prod',
        refType: SourceRefType.TAG,
        mainBranch: false,
        events: [],
      },
    ],
    standaloneEvents: [
      {
        projectId: 501,
        targetType: SourceTargetType.WIKI_PAGE,
        title: 'Acme billing runbook',
        events: [],
      },
      { projectId: 502, targetType: SourceTargetType.MILESTONE, title: 'Acme Q4', events: [] },
    ],
  };
}

describe('PreviewAnonymizer', () => {
  const anonymizer = new PreviewAnonymizer();

  function anonymize() {
    const aliases = anonymizer.createAliases();
    return { aliases, day: anonymizer.anonymizeDay(createDay(), aliases) };
  }

  it('leaves no source string in the day', () => {
    const text = JSON.stringify(anonymize().day);

    for (const secret of SECRETS) {
      expect(text).not.toContain(secret);
    }
  });

  it('gives each person and project one alias everywhere', () => {
    const { day } = anonymize();
    const [issue] = day.issues;
    const [mergeRequest] = issue.mergeRequests;

    expect(issue.assignees).toEqual(['user-1', 'user-2']);
    expect(mergeRequest.author).toBe('user-1');
    expect(mergeRequest.reviewers).toEqual(['user-2']);
    expect(mergeRequest.notes[1]).toMatchObject({
      authorUsername: 'user-2',
      authorName: 'user-2',
    });
    expect(mergeRequest.notes[2].body).toBe('requested review from @user-2 and unassigned @user-1');
    expect(mergeRequest.facts[0]).toMatchObject({ actor: 'user-1', users: ['user-2'] });
    expect(mergeRequest.startOfDay).toMatchObject({ assignees: ['user-1'], reviewers: ['user-2'] });
    expect(day.projects).toEqual([
      {
        id: 1,
        name: 'project-1',
        path: 'group/project-1',
        webUrl: 'https://gitlab.example.com/group/project-1',
      },
    ]);
    expect(issue.projectId).toBe(1);
    expect(mergeRequest.closesIssues[0]).toEqual({
      projectId: 2,
      iid: 3,
      title: 'Issue 3',
      webUrl: 'https://gitlab.example.com/group/project-2/-/issues/3',
    });
    expect(mergeRequest.events[0].projectId).toBe(1);
  });

  it('keeps aliases between days of one run', () => {
    const aliases = anonymizer.createAliases();
    const first = anonymizer.anonymizeDay(createDay(), aliases);
    const second = anonymizer.anonymizeDay(createDay(), aliases);

    expect(second).toEqual(first);
    expect(anonymizer.toUser('anna.petrova', aliases)).toBe('user-1');
  });

  it('keeps V1 labels and replaces the others', () => {
    const { day } = anonymize();
    const [issue] = day.issues;
    const [mergeRequest] = issue.mergeRequests;

    expect(issue.labels).toEqual(['type::bug', 'label-1']);
    expect(mergeRequest.labels).toEqual(['status::review', 'label-2']);
    expect(mergeRequest.labelEvents.map((event) => event.labelName)).toEqual([
      'label-1',
      'Status::Ready_for QA',
    ]);
    expect(issue.facts[0].value).toBe('label-2');
    expect(issue.startOfDay.labels).toEqual(['type::bug', 'label-1']);
  });

  it('gives milestones and iterations aliases and keeps the weights', () => {
    const { day } = anonymize();
    const [issue] = day.issues;
    const [mergeRequest] = issue.mergeRequests;

    expect([issue.milestone, mergeRequest.milestone, mergeRequest.startOfDay.milestone]).toEqual([
      'milestone-1',
      'milestone-1',
      'milestone-2',
    ]);
    expect([issue.iteration, issue.startOfDay.iteration]).toEqual(['iteration-1', 'iteration-2']);
    expect(issue.facts.at(-1)?.value).toBe('iteration-1');
    expect([issue.weight, issue.startOfDay.weight, issue.facts.at(-2)?.value]).toEqual([5, 3, '5']);
    expect([issue.timeSpent, issue.mergeRequests[0].timeSpent]).toEqual([5400, 1800]);
  });

  it('gives wiki pages and milestones of the day aliases', () => {
    const { day } = anonymize();

    expect(day.standaloneEvents.map(({ title }) => title)).toEqual(['page-1', 'milestone-1']);
  });

  it('keeps the kind of a link and hides the reference of a move', () => {
    const anonymizer = new PreviewAnonymizer();
    const day: GroupedDailyData = {
      ...createDay(),
      issues: [
        {
          ...createDay().issues[0],
          facts: [
            {
              kind: SourceActionKind.LINKED,
              at: '2026-11-05T08:00:00.000Z',
              value: 'blocked by',
              actor: 'anna.petrova',
              own: true,
              users: [],
            },
            {
              kind: SourceActionKind.MOVED_IN,
              at: '2026-11-05T09:00:00.000Z',
              value: 'acme-corp/billing-api#12',
              actor: 'anna.petrova',
              own: true,
              users: [],
            },
          ],
        },
      ],
    };

    const [issue] = anonymizer.anonymizeDay(day, anonymizer.createAliases()).issues;

    expect(issue.facts.map((fact) => fact.value)).toEqual(['blocked by', 'value']);
  });

  it('gives a mentioned commit the alias of the same pushed commit', () => {
    const { day } = anonymize();
    const [issue] = day.issues;
    const pushData = issue.mergeRequests[0].events[0].pushData;

    expect(issue.facts[3].value).toBe('sha-1');
    expect(pushData?.commits[0].id).toBe('sha-1');
  });

  it('keeps the Conventional Commits type of titles without other words of the scope', () => {
    const anonymizer = new PreviewAnonymizer();
    const day = createDay();
    const mergeRequest = (title: string) => ({ ...createMergeRequest(), title });
    const anonymized = anonymizer.anonymizeDay(
      {
        ...day,
        standaloneMergeRequests: [
          mergeRequest('feat(billing): the price list'),
          mergeRequest('chore(deps): update eslint'),
          mergeRequest('Draft: fix: the payment form'),
          mergeRequest('Resolve "the payment form"'),
        ],
      },
      anonymizer.createAliases(),
    );

    expect(anonymized.standaloneMergeRequests.map(({ title }) => title)).toEqual([
      'feat: Merge request 7',
      'chore(deps): Merge request 7',
      'fix: Merge request 7',
      'Merge request 7',
    ]);
  });

  it('keeps what the rules read from branches, commits and statuses', () => {
    const { day } = anonymize();
    const [issue] = day.issues;
    const [mergeRequest] = issue.mergeRequests;
    const pushData = mergeRequest.events[0].pushData;

    expect(mergeRequest.sourceBranch).toBe('12-branch-1');
    expect(issue.facts[1].value).toBe('12-branch-1');
    expect(day.standaloneMergeRequests[0].sourceBranch).toBe('renovate-branch-2');
    expect(day.standalonePushes.map((push) => push.ref)).toEqual(['main', 'v2.3', 'tag-1']);
    expect(issue.pushes[0]).toMatchObject({ projectId: issue.projectId, ref: '12-branch-1' });
    expect(pushData?.ref).toBe('12-branch-1');
    expect(pushData?.commits).toEqual([
      { id: 'sha-1', title: 'commit 1' },
      { id: 'sha-2', title: 'commit 2 (test)' },
      { id: 'sha-3', title: 'commit 3 (тест)' },
    ]);
    expect(issue.status).toBe('status-1');
    expect(issue.facts[2].value).toBe('Done');
    expect(issue.startOfDay.status).toBe('status-1');
  });

  it('keeps the system notes the rules parse and hides the rest', () => {
    const { day } = anonymize();
    const [mergeRequest] = day.issues[0].mergeRequests;

    expect(mergeRequest.notes.map((note) => note.body)).toEqual([
      'comment',
      'approved this merge request',
      'requested review from @user-2 and unassigned @user-1',
      'set status to **status-1**',
      'set status to **In progress**',
      'created branch [`12-branch-1`](https://gitlab.example.com)',
      'changed title from **Title** to **Title**',
      'changed the description',
      'system note',
    ]);
    expect(mergeRequest.notes[0]).toMatchObject({ resolvable: true, resolved: false });
    expect(mergeRequest.events[1]).toMatchObject({
      targetTitle: 'Title',
      noteBody: 'comment',
    });
  });
});
