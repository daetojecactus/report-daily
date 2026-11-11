import { describe, expect, it } from 'vitest';
import {
  ItemState,
  SourceActionKind,
  SourceEventAction,
  SourceRefType,
  WorkItemType,
} from 'src/modules/application/source/types/source.enums';
import type {
  GroupedIssue,
  GroupedMergeRequest,
} from 'src/modules/application/source/types/source-day.interface';
import { TaskKind, WorkflowState } from 'src/modules/application/trait/types/trait.enums';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { ActivityAction, ActivityDetail, ActivityRule } from '../types/activity.enums';
import type {
  ActivityCandidate,
  ActivityLine,
  ActivityLineSignals,
} from '../types/activity.interface';
import {
  at,
  choose,
  createIssue,
  createMergeRequest,
  fact,
  issueLine,
  ME,
  OTHER,
  otherFact,
  othersMergeRequest,
  pushEvent,
  refEvent,
  toSignals,
} from './activity.fixture';

type Verdict = 'proposed' | 'phrase' | 'changed';

interface Scenario {
  id: string;
  name: string;
  role: JobRole;
  verdict: Verdict;
  line: ActivityLine;
  main: Partial<ActivityCandidate>;
  signals?: Partial<ActivityLineSignals>;
  dropped?: ActivityRule[];
}

function task(overrides: Partial<GroupedIssue> = {}) {
  return issueLine(createIssue(overrides));
}

function withMergeRequest(mergeRequest: GroupedMergeRequest, issue: Partial<GroupedIssue> = {}) {
  return task({ ...issue, mergeRequests: [mergeRequest] });
}

function label(value: string, time = at(10)) {
  return fact(SourceActionKind.LABEL_ADDED, time, { value });
}

const bot = {
  author: 'renovate-bot',
  assignees: ['renovate-bot'],
  sourceBranch: 'renovate/eslint-10.x',
};

const { DEVELOPER, QA, PROJECT_MANAGER, SYSTEM_ANALYST } = JobRole;

const SCENARIOS: Scenario[] = [
  {
    id: '5.1',
    name: 'an analyst only edits the description',
    role: SYSTEM_ANALYST,
    verdict: 'proposed',
    line: task({ facts: [fact(SourceActionKind.DESCRIPTION_CHANGED, at(10))] }),
    main: { action: ActivityAction.REQUIREMENTS },
  },
  {
    id: '5.1',
    name: 'a developer only edits the description',
    role: DEVELOPER,
    verdict: 'phrase',
    line: task({ facts: [fact(SourceActionKind.DESCRIPTION_CHANGED, at(10))] }),
    main: { action: ActivityAction.REQUIREMENTS },
  },
  {
    id: '5.1',
    name: 'only the title is edited',
    role: PROJECT_MANAGER,
    verdict: 'changed',
    line: task({ facts: [fact(SourceActionKind.TITLE_CHANGED, at(10))] }),
    main: { action: ActivityAction.EDITED, details: [ActivityDetail.TITLE] },
  },
  {
    id: '5.2',
    name: 'only a state by a label: sent to review',
    role: DEVELOPER,
    verdict: 'proposed',
    line: task({ labels: ['status::review'], facts: [label('status::review')] }),
    main: { action: ActivityAction.STATE_SET, state: WorkflowState.REVIEW },
  },
  {
    id: '5.2',
    name: 'only a state by a label: taken into the plan',
    role: PROJECT_MANAGER,
    verdict: 'proposed',
    line: task({ labels: ['status::sprint backlog'], facts: [label('status::sprint backlog')] }),
    main: { action: ActivityAction.STATE_SET, state: WorkflowState.PLANNED },
  },
  {
    id: '5.2',
    name: 'only a state by a label: put on hold',
    role: DEVELOPER,
    verdict: 'proposed',
    line: task({ labels: ['status::hold'], facts: [label('status::hold')] }),
    main: { action: ActivityAction.STATE_SET, state: WorkflowState.BLOCKED },
  },
  {
    id: '5.3',
    name: 'GitLab sets the Status field on closing by itself',
    role: PROJECT_MANAGER,
    verdict: 'proposed',
    line: task({
      state: ItemState.CLOSED,
      closedOnReportDate: true,
      facts: [
        fact(SourceActionKind.CLOSED, at(10)),
        fact(SourceActionKind.STATUS_SET, at(10, 0, 2), { value: 'Done' }),
      ],
    }),
    main: { action: ActivityAction.CLOSED },
    dropped: [ActivityRule.AUTOMATIC_STATUS],
  },
  {
    id: '5.3',
    name: 'the Status field set by hand',
    role: DEVELOPER,
    verdict: 'proposed',
    line: task({
      status: 'In progress',
      facts: [fact(SourceActionKind.STATUS_SET, at(10), { value: 'In progress' })],
    }),
    main: { action: ActivityAction.STATE_SET, state: WorkflowState.IN_PROGRESS },
  },
  {
    id: '5.4',
    name: 'a push to the branch of the issue without a merge request',
    role: DEVELOPER,
    verdict: 'proposed',
    line: task({
      pushes: [
        {
          projectId: 1,
          ref: '12-login',
          refType: SourceRefType.BRANCH,
          mainBranch: false,
          events: [{ ...pushEvent(at(11)), actionName: SourceEventAction.PUSHED_NEW }],
        },
      ],
    }),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.STARTED] },
  },
  {
    id: '5.5',
    name: 'pushes to a draft merge request',
    role: DEVELOPER,
    verdict: 'proposed',
    line: withMergeRequest(createMergeRequest({ draft: true, events: [pushEvent(at(11))] })),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.DRAFT] },
  },
  {
    id: '5.6',
    name: 'pushes to a merge request of the dependency bot',
    role: DEVELOPER,
    verdict: 'proposed',
    line: withMergeRequest(othersMergeRequest({ ...bot, events: [pushEvent(at(11))] }), {
      assignees: [OTHER],
    }),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.DEPENDENCIES] },
  },
  {
    id: '5.6',
    name: 'merges a merge request of the dependency bot',
    role: DEVELOPER,
    verdict: 'proposed',
    line: withMergeRequest(
      othersMergeRequest({
        ...bot,
        state: ItemState.MERGED,
        mergedOnReportDate: true,
        facts: [fact(SourceActionKind.MERGED, at(15))],
      }),
      { assignees: [OTHER] },
    ),
    main: { action: ActivityAction.MERGED_OTHER },
    signals: { dependencies: true },
  },
  {
    id: '5.6',
    name: 'approves a merge request of the dependency bot',
    role: DEVELOPER,
    verdict: 'proposed',
    line: withMergeRequest(
      othersMergeRequest({ ...bot, facts: [fact(SourceActionKind.APPROVED, at(12))] }),
      { assignees: [OTHER] },
    ),
    main: { action: ActivityAction.APPROVED, details: [ActivityDetail.DEPENDENCIES] },
  },
  {
    id: '5.7',
    name: 'merges a release merge request that closes several issues',
    role: DEVELOPER,
    verdict: 'phrase',
    line: {
      issue: null,
      event: null,
      pushes: [],
      mergeRequests: [
        createMergeRequest({
          sourceBranch: 'release-3',
          state: ItemState.MERGED,
          mergedOnReportDate: true,
          closesIssues: [12, 13, 14].map((iid) => ({
            projectId: 1,
            iid,
            title: `Issue ${iid}`,
            webUrl: 'https://gitlab.example.com',
          })),
          facts: [fact(SourceActionKind.MERGED, at(15))],
        }),
      ],
    },
    main: { action: ActivityAction.MERGED },
  },
  {
    id: '5.8',
    name: 'one of several assignees works on code',
    role: DEVELOPER,
    verdict: 'proposed',
    line: withMergeRequest(othersMergeRequest({ events: [pushEvent(at(11))] }), {
      assignees: [OTHER, ME],
    }),
    main: { action: ActivityAction.CODE },
    signals: { assignee: true },
  },
  {
    id: '5.9',
    name: 'creates a branch from the issue without pushes',
    role: DEVELOPER,
    verdict: 'proposed',
    line: task({ facts: [fact(SourceActionKind.BRANCH_CREATED, at(10), { value: '12-login' })] }),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.STARTED] },
  },
  {
    id: '5.10',
    name: 'an incident by its work item type',
    role: DEVELOPER,
    verdict: 'phrase',
    line: withMergeRequest(
      createMergeRequest({
        state: ItemState.MERGED,
        mergedOnReportDate: true,
        facts: [fact(SourceActionKind.MERGED, at(15))],
      }),
      { workItemType: WorkItemType.INCIDENT },
    ),
    main: { action: ActivityAction.MERGED },
    signals: { kind: TaskKind.INCIDENT },
  },
  {
    id: '5.10',
    name: 'documentation by a Conventional Commits title',
    role: DEVELOPER,
    verdict: 'phrase',
    line: withMergeRequest(
      createMergeRequest({ title: 'docs: the setup guide', events: [pushEvent(at(11))] }),
    ),
    main: { action: ActivityAction.CODE },
    signals: { kind: TaskKind.DOCUMENTATION },
  },
  {
    id: '6.1',
    name: 'closed by the employee',
    role: PROJECT_MANAGER,
    verdict: 'proposed',
    line: task({
      state: ItemState.CLOSED,
      closedOnReportDate: true,
      facts: [fact(SourceActionKind.CLOSED, at(16))],
    }),
    main: { action: ActivityAction.CLOSED },
  },
  {
    id: '6.1',
    name: 'closed by another after the employee approved the merge request',
    role: QA,
    verdict: 'proposed',
    line: withMergeRequest(
      othersMergeRequest({ reviewers: [ME], facts: [fact(SourceActionKind.APPROVED, at(12))] }),
      {
        assignees: [OTHER],
        state: ItemState.CLOSED,
        closedOnReportDate: true,
        facts: [otherFact(SourceActionKind.CLOSED, at(16))],
      },
    ),
    main: { action: ActivityAction.APPROVED },
  },
  {
    id: '6.1',
    name: 'closed by another, the employee is the assignee',
    role: DEVELOPER,
    verdict: 'proposed',
    line: task({
      state: ItemState.CLOSED,
      closedOnReportDate: true,
      facts: [fact(SourceActionKind.COMMENTED, at(10)), otherFact(SourceActionKind.CLOSED, at(16))],
    }),
    main: { action: ActivityAction.COMPLETED },
  },
  {
    id: '6.1',
    name: 'closed by another, the employee only commented',
    role: SYSTEM_ANALYST,
    verdict: 'proposed',
    line: task({
      assignees: [OTHER],
      state: ItemState.CLOSED,
      closedOnReportDate: true,
      facts: [fact(SourceActionKind.COMMENTED, at(10)), otherFact(SourceActionKind.CLOSED, at(16))],
    }),
    main: { action: ActivityAction.COMMENTED },
    signals: { closedToday: true },
  },
  {
    id: '6.2',
    name: 'Russian words of a test commit',
    role: DEVELOPER,
    verdict: 'proposed',
    line: withMergeRequest(createMergeRequest({ events: [pushEvent(at(11), ['Поправил тесты'])] })),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.TESTS] },
  },
  {
    id: '6.2',
    name: 'tests found in the commits of a push',
    role: QA,
    verdict: 'proposed',
    line: withMergeRequest(
      createMergeRequest({
        events: [
          refEvent(at(11), SourceEventAction.PUSHED_TO, {
            commitCount: 2,
            commitTitle: 'update the page',
            commits: [
              { id: 'a1', title: 'add e2e for payments' },
              { id: 'a2', title: 'update the page' },
            ],
          }),
        ],
      }),
    ),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.TESTS] },
  },
];

describe('V2 scenarios in the action engine', () => {
  it.each(SCENARIOS)('$id: $name ($verdict)', (scenario) => {
    const choice = choose(scenario.line, scenario.role);
    const signals = toSignals(scenario.line, scenario.role);

    expect(choice.main).toMatchObject(scenario.main);
    expect(signals).toMatchObject(scenario.signals ?? {});
    expect(signals.dropped.map(({ rule }) => rule)).toEqual(scenario.dropped ?? []);
  });

  it('covers every V2 scenario of SCENARIOS 5 and 6', () => {
    expect(new Set(SCENARIOS.map(({ id }) => id))).toEqual(
      new Set([
        '5.1',
        '5.2',
        '5.3',
        '5.4',
        '5.5',
        '5.6',
        '5.7',
        '5.8',
        '5.9',
        '5.10',
        '6.1',
        '6.2',
      ]),
    );
    expect(
      SCENARIOS.reduce<Record<string, number>>(
        (total, { verdict }) => ({ ...total, [verdict]: (total[verdict] ?? 0) + 1 }),
        {},
      ),
    ).toEqual({ proposed: 19, phrase: 4, changed: 1 });
  });
});
