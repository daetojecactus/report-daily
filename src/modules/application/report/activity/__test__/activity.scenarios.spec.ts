import { describe, expect, it } from 'vitest';
import { ItemState, SourceActionKind } from 'src/modules/application/source/source.enums';
import type {
  GroupedIssue,
  GroupedMergeRequest,
} from 'src/modules/application/source/source.interface';
import { TaskFlag, TaskKind, WorkflowState } from 'src/modules/application/trait/trait.enums';
import { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityChains } from '../activity.chains';
import { ActivityAction, ActivityDetail } from '../activity.enums';
import type { ActivityCandidate, ActivityLine, ActivityLineSignals } from '../activity.interface';
import { ActivitySelector } from '../activity.selector';
import {
  at,
  createDetectors,
  createIssue,
  createMergeRequest,
  fact,
  issueLine,
  ME,
  OTHER,
  otherFact,
  othersMergeRequest,
  pushEvent,
  toSignals,
} from './activity.fixture';

type Verdict = 'same' | 'phrase' | 'intentional' | 'rule';

interface Scenario {
  id: string;
  name: string;
  role: JobRole;
  v1: string;
  verdict: Verdict;
  line: ActivityLine;
  main: Partial<ActivityCandidate>;
  signals?: Partial<ActivityLineSignals>;
  secondary?: ActivityAction[];
}

function task({ start = [], ...overrides }: Partial<GroupedIssue> & { start?: string[] } = {}) {
  return issueLine(
    createIssue({ ...overrides, startOfDay: { ...createIssue().startOfDay, labels: start } }),
  );
}

function steady(labels: string[]) {
  return { labels, start: labels };
}

function label(value: string, time = at(10)) {
  return fact(SourceActionKind.LABEL_ADDED, time, { value });
}

function comments(count: number) {
  return Array.from({ length: count }, (_, minute) =>
    fact(SourceActionKind.COMMENTED, at(10, minute)),
  );
}

function pushed(titles: string[], overrides: Partial<GroupedMergeRequest> = {}) {
  return createMergeRequest({ events: [pushEvent(at(11), titles)], ...overrides });
}

function merged(overrides: Partial<GroupedMergeRequest> = {}) {
  return createMergeRequest({ facts: [fact(SourceActionKind.MERGED, at(15))], ...overrides });
}

function reviewing(overrides: Partial<GroupedMergeRequest> = {}) {
  return othersMergeRequest({ reviewers: [ME], ...overrides });
}

const observer = { assignees: [OTHER] };

const { DEVELOPER, QA, PROJECT_MANAGER, SYSTEM_ANALYST } = JobRole;

const SCENARIOS: Scenario[] = [
  {
    id: '1',
    name: 'a developer sends the task to QA',
    role: DEVELOPER,
    v1: 'TASK_SENT_TO_QA',
    verdict: 'same',
    line: task({ labels: ['status::ready for qa'], facts: [label('status::ready for qa')] }),
    main: { action: ActivityAction.STATE_SET, state: WorkflowState.READY_FOR_QA },
  },
  {
    id: '2',
    name: 'someone else sends the task of a developer to QA',
    role: DEVELOPER,
    v1: 'TASK_SENT_TO_QA',
    verdict: 'intentional',
    line: task({
      labels: ['status::ready for qa'],
      facts: [otherFact(SourceActionKind.LABEL_ADDED, at(10), { value: 'status::ready for qa' })],
    }),
    main: { action: ActivityAction.STATE_ONLY, state: WorkflowState.READY_FOR_QA },
  },
  {
    id: '3',
    name: 'a task waits for QA',
    role: QA,
    v1: 'QA_AWAITING_TESTING',
    verdict: 'same',
    line: task({ ...observer, ...steady(['status::ready for qa']) }),
    main: { action: ActivityAction.STATE_ONLY, state: WorkflowState.READY_FOR_QA },
  },
  {
    id: '4',
    name: 'QA takes the task into testing',
    role: QA,
    v1: 'QA_IN_PROGRESS',
    verdict: 'same',
    line: task({ ...observer, labels: ['status::testing'], facts: [label('status::testing')] }),
    main: { action: ActivityAction.STATE_SET, state: WorkflowState.TESTING },
  },
  {
    id: '5',
    name: 'a QA reviewer takes the task into testing',
    role: QA,
    v1: 'QA_IN_PROGRESS',
    verdict: 'same',
    line: task({
      ...observer,
      labels: ['status::testing'],
      facts: [label('status::testing')],
      mergeRequests: [reviewing()],
    }),
    main: { action: ActivityAction.STATE_SET, state: WorkflowState.TESTING },
  },
  {
    id: '6',
    name: 'closing the task outweighs taking it into testing',
    role: QA,
    v1: 'VERIFIED_FIX',
    verdict: 'same',
    line: task({
      ...observer,
      labels: ['status::testing'],
      closedOnReportDate: true,
      facts: [label('status::testing'), fact(SourceActionKind.CLOSED, at(11))],
    }),
    main: { action: ActivityAction.CLOSED },
  },
  {
    id: '7',
    name: 'the task of a developer is in testing',
    role: DEVELOPER,
    v1: 'TASK_IN_QA_TESTING',
    verdict: 'same',
    line: task(steady(['status::testing'])),
    main: { action: ActivityAction.STATE_ONLY, state: WorkflowState.TESTING },
  },
  {
    id: '8',
    name: 'QA returns the task to development',
    role: QA,
    v1: 'QA_RETURNED_TO_DEV',
    verdict: 'same',
    line: task({ ...observer, labels: ['qa::returned'], facts: [label('qa::returned')] }),
    main: { action: ActivityAction.RETURNED, details: [ActivityDetail.AFTER_QA] },
  },
  {
    id: '9',
    name: 'a return outweighs remarks and the state of a bug',
    role: QA,
    v1: 'QA_RETURNED_TO_DEV',
    verdict: 'same',
    line: task({
      ...observer,
      start: ['type::bug', 'status::testing'],
      labels: ['type::bug', 'status::testing', 'qa::returned'],
      facts: [label('qa::returned', at(15))],
      mergeRequests: [reviewing({ facts: comments(5) })],
    }),
    main: {
      action: ActivityAction.RETURNED,
      details: [ActivityDetail.AFTER_QA, ActivityDetail.WITH_REMARKS],
    },
  },
  {
    id: '10',
    name: 'a developer pushes to a returned task',
    role: DEVELOPER,
    v1: 'DEV_FIXING_AFTER_QA',
    verdict: 'same',
    line: task({ ...steady(['qa::returned']), mergeRequests: [pushed(['fix: validation error'])] }),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.AFTER_QA] },
  },
  {
    id: '11',
    name: 'a returned task without pushes',
    role: DEVELOPER,
    v1: 'DEV_FIXING_AFTER_QA',
    verdict: 'intentional',
    line: task(steady(['qa::returned'])),
    main: { action: ActivityAction.STATE_ONLY },
    signals: { endFlags: [TaskFlag.RETURNED_FROM_QA] },
  },
  {
    id: '12',
    name: 'a developer fixes the remarks and returns the task to QA',
    role: DEVELOPER,
    v1: 'DEV_RESUBMITTED_TO_QA',
    verdict: 'same',
    line: task({
      start: ['qa::returned'],
      labels: ['status::ready for qa'],
      facts: [label('status::ready for qa', at(14))],
      mergeRequests: [pushed(['fix: qa remarks'])],
    }),
    main: {
      action: ActivityAction.STATE_SET,
      state: WorkflowState.READY_FOR_QA,
      details: [ActivityDetail.AFTER_QA, ActivityDetail.WITH_CODE],
    },
  },
  {
    id: '13',
    name: 'QA pushes to an internal QA task',
    role: QA,
    v1: 'QA_AUTOMATION_DEVELOPED',
    verdict: 'phrase',
    line: task({ labels: ['type::qa'], mergeRequests: [pushed(['feat: add account tests'])] }),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.TESTS] },
    signals: { kinds: [TaskKind.QA_INTERNAL] },
  },
  {
    id: '14',
    name: 'QA fixes flaky tests in a maintenance QA task',
    role: QA,
    v1: 'QA_AUTOMATION_MAINTAINED',
    verdict: 'phrase',
    line: task({
      labels: ['type::qa', 'type::maintenance'],
      mergeRequests: [pushed(['fix: flaky tests'])],
    }),
    main: {
      action: ActivityAction.CODE,
      details: [ActivityDetail.TESTS, ActivityDetail.REFACTORING],
    },
    signals: { kinds: [TaskKind.MAINTENANCE, TaskKind.QA_INTERNAL] },
  },
  {
    id: '15',
    name: 'QA comments in a maintenance QA task without code',
    role: QA,
    v1: 'QA_TEST_ENVIRONMENT_SETUP',
    verdict: 'phrase',
    line: task({ labels: ['type::qa', 'type::maintenance'], facts: comments(2) }),
    main: { action: ActivityAction.COMMENTED },
    signals: { kinds: [TaskKind.MAINTENANCE, TaskKind.QA_INTERNAL] },
  },
  {
    id: '16',
    name: 'QA comments in an internal QA task',
    role: QA,
    v1: 'QA_INTERNAL_TASK',
    verdict: 'phrase',
    line: task({ labels: ['type::qa'], facts: comments(1) }),
    main: { action: ActivityAction.COMMENTED },
    signals: { kinds: [TaskKind.QA_INTERNAL] },
  },
  {
    id: '17',
    name: 'a developer pushes to an internal QA task',
    role: DEVELOPER,
    v1: 'QA_AUTOMATION_DEVELOPED',
    verdict: 'phrase',
    line: task({ labels: ['type::qa'], mergeRequests: [pushed(['chore: page objects'])] }),
    main: { action: ActivityAction.CODE, details: [] },
    signals: { kinds: [TaskKind.QA_INTERNAL] },
  },
  {
    id: '18',
    name: 'QA merges an own internal QA merge request',
    role: QA,
    v1: 'QA_AUTOMATION_DEVELOPED',
    verdict: 'phrase',
    line: task({
      labels: ['type::qa'],
      mergeRequests: [
        pushed(['test: ssl admin cases'], { facts: [fact(SourceActionKind.MERGED, at(15))] }),
      ],
    }),
    main: { action: ActivityAction.MERGED },
    signals: { kinds: [TaskKind.QA_INTERNAL] },
  },
  {
    id: '19',
    name: 'QA merges an internal QA merge request without pushes',
    role: QA,
    v1: 'QA_AUTOMATION_DEVELOPED',
    verdict: 'phrase',
    line: task({ labels: ['type::qa'], mergeRequests: [merged()] }),
    main: { action: ActivityAction.MERGED },
    signals: { kinds: [TaskKind.QA_INTERNAL] },
  },
  {
    id: '20',
    name: 'QA pushes to a task that needs E2E tests',
    role: QA,
    v1: 'QA_E2E_COVERAGE_ADDED',
    verdict: 'phrase',
    line: task({ labels: ['test::e2e required'], mergeRequests: [pushed(['add checkout flow'])] }),
    main: { action: ActivityAction.CODE, details: [] },
    signals: { endFlags: [TaskFlag.E2E_REQUIRED] },
  },
  {
    id: '21',
    name: 'a developer pushes test commits to a task that needs E2E tests',
    role: DEVELOPER,
    v1: 'QA_E2E_COVERAGE_ADDED',
    verdict: 'phrase',
    line: task({
      labels: ['test::e2e required'],
      mergeRequests: [pushed(['test: e2e for bucket page'])],
    }),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.TESTS] },
    signals: { endFlags: [TaskFlag.E2E_REQUIRED] },
  },
  {
    id: '22',
    name: 'a developer pushes product code to a task that needs E2E tests',
    role: DEVELOPER,
    v1: 'not QA_E2E_COVERAGE_ADDED',
    verdict: 'same',
    line: task({
      labels: ['test::e2e required'],
      mergeRequests: [pushed(['feat: bucket endpoint'])],
    }),
    main: { action: ActivityAction.CODE, details: [] },
  },
  {
    id: '23',
    name: 'QA merges an E2E merge request without pushes',
    role: QA,
    v1: 'QA_E2E_COVERAGE_ADDED',
    verdict: 'phrase',
    line: task({ labels: ['type::feature', 'test::e2e required'], mergeRequests: [merged()] }),
    main: { action: ActivityAction.MERGED },
    signals: { endFlags: [TaskFlag.E2E_REQUIRED] },
  },
  {
    id: '24',
    name: 'a developer merges E2E coverage',
    role: DEVELOPER,
    v1: 'QA_E2E_COVERAGE_ADDED',
    verdict: 'phrase',
    line: task({
      labels: ['type::feature', 'test::e2e required'],
      mergeRequests: [
        pushed(['test: add e2e specs'], { facts: [fact(SourceActionKind.MERGED, at(15))] }),
      ],
    }),
    main: { action: ActivityAction.MERGED },
    signals: { endFlags: [TaskFlag.E2E_REQUIRED] },
    secondary: [ActivityAction.CODE],
  },
  ...[PROJECT_MANAGER, SYSTEM_ANALYST].flatMap((role, index): Scenario[] => [
    {
      id: String(25 + index),
      name: `${role} sends the task to QA`,
      role,
      v1: 'TASK_SENT_TO_QA',
      verdict: 'same',
      line: task({
        ...observer,
        labels: ['status::ready for qa'],
        facts: [label('status::ready for qa')],
      }),
      main: { action: ActivityAction.STATE_SET, state: WorkflowState.READY_FOR_QA },
    },
    {
      id: String(27 + index),
      name: `${role} comments on a task returned from QA`,
      role,
      v1: 'TASK_RETURNED_FROM_QA',
      verdict: 'intentional',
      line: task({ ...observer, ...steady(['qa::returned']), facts: comments(1) }),
      main: { action: ActivityAction.COMMENTED },
    },
    {
      id: String(29 + index),
      name: `${role} comments on a task in testing`,
      role,
      v1: 'TASK_IN_QA_TESTING',
      verdict: 'intentional',
      line: task({ ...observer, ...steady(['status::testing']), facts: comments(1) }),
      main: { action: ActivityAction.COMMENTED },
    },
  ]),
  {
    id: '31',
    name: 'a project manager closes a returned feature',
    role: PROJECT_MANAGER,
    v1: 'REVIEWED_AND_CLOSED',
    verdict: 'same',
    line: task({
      ...observer,
      ...steady(['type::feature', 'qa::returned']),
      closedOnReportDate: true,
      facts: [fact(SourceActionKind.CLOSED, at(16))],
    }),
    main: { action: ActivityAction.CLOSED },
  },
  {
    id: '32',
    name: 'QA confirms that testing passed',
    role: QA,
    v1: 'TESTED_AND_APPROVED',
    verdict: 'same',
    line: task({ ...observer, labels: ['status::qa passed'], facts: [label('status::qa passed')] }),
    main: { action: ActivityAction.STATE_SET, state: WorkflowState.QA_PASSED },
  },
  {
    id: '33',
    name: 'the task of a developer passed testing earlier',
    role: DEVELOPER,
    v1: 'DEV_PASSED_QA',
    verdict: 'same',
    line: task(steady(['status::qa passed'])),
    main: { action: ActivityAction.STATE_ONLY, state: WorkflowState.QA_PASSED },
  },
  {
    id: '34',
    name: 'a project manager comments on a task that passed testing',
    role: PROJECT_MANAGER,
    v1: 'TASK_IN_QA_TESTING',
    verdict: 'intentional',
    line: task({ ...observer, ...steady(['status::qa passed']), facts: comments(1) }),
    main: { action: ActivityAction.COMMENTED },
  },
  ...[DEVELOPER, QA, PROJECT_MANAGER].map((role, index): Scenario => ({
    id: String(35 + index),
    name: `${role} puts the task on hold and pushes`,
    role,
    v1: 'PUT_ON_HOLD',
    verdict: 'same',
    line: task({
      labels: ['status::hold'],
      facts: [label('status::hold')],
      mergeRequests: [pushed(['wip'])],
    }),
    main: { action: ActivityAction.STATE_SET, state: WorkflowState.BLOCKED },
  })),
  {
    id: '38',
    name: 'closing the task outweighs putting it on hold',
    role: DEVELOPER,
    v1: 'not PUT_ON_HOLD',
    verdict: 'same',
    line: task({
      labels: ['status::hold'],
      state: ItemState.CLOSED,
      closedOnReportDate: true,
      facts: [label('status::hold'), fact(SourceActionKind.CLOSED, at(11))],
    }),
    main: { action: ActivityAction.CLOSED },
  },
  ...['status::todo', 'status::sprint backlog'].map((status, index): Scenario => ({
    id: String(39 + index),
    name: `a project manager plans the task with ${status}`,
    role: PROJECT_MANAGER,
    v1: 'PLANNED_FOR_SPRINT',
    verdict: 'same',
    line: task({ ...observer, labels: [status], facts: [label(status)] }),
    main: { action: ActivityAction.STATE_SET, state: WorkflowState.PLANNED },
  })),
  {
    id: '41',
    name: 'a removed needs-rebase with a push resolves conflicts',
    role: DEVELOPER,
    v1: 'RESOLVED_MERGE_CONFLICTS',
    verdict: 'same',
    line: task({
      mergeRequests: [
        pushed(['merge branch main'], {
          facts: [otherFact(SourceActionKind.LABEL_REMOVED, at(9), { value: 'needs-rebase' })],
        }),
      ],
    }),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.REBASE] },
  },
  {
    id: '42',
    name: 'a removed needs-rebase without a push resolves nothing',
    role: DEVELOPER,
    v1: 'not RESOLVED_MERGE_CONFLICTS',
    verdict: 'same',
    line: task({
      facts: comments(1),
      mergeRequests: [
        createMergeRequest({
          facts: [otherFact(SourceActionKind.LABEL_REMOVED, at(9), { value: 'needs-rebase' })],
        }),
      ],
    }),
    main: { action: ActivityAction.COMMENTED },
  },
  {
    id: '43',
    name: 'unit tests for a task that needs them',
    role: DEVELOPER,
    v1: 'WROTE_TESTS',
    verdict: 'same',
    line: task({
      labels: ['test::unit'],
      mergeRequests: [pushed(['test: cover service with unit specs'])],
    }),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.TESTS] },
  },
  ...[QA, PROJECT_MANAGER].map((role): Scenario => ({
    id: role === QA ? '44' : '46',
    name: `${role} comments on a task closed long ago`,
    role,
    v1: 'COMMENTED',
    verdict: 'same',
    line: task({ ...observer, state: ItemState.CLOSED, facts: comments(1) }),
    main: { action: ActivityAction.COMMENTED },
  })),
  {
    id: '45',
    name: 'someone else closed the task today',
    role: QA,
    v1: 'VERIFIED_FIX',
    verdict: 'intentional',
    line: task({
      ...observer,
      state: ItemState.CLOSED,
      closedOnReportDate: true,
      facts: [otherFact(SourceActionKind.CLOSED, at(15))],
    }),
    main: { action: ActivityAction.STATE_ONLY },
  },
  {
    id: '47',
    name: 'an assignee pushes to a task closed and merged long ago',
    role: DEVELOPER,
    v1: 'WROTE_CODE',
    verdict: 'same',
    line: task({
      state: ItemState.CLOSED,
      mergeRequests: [pushed(['feat: next step'], { state: ItemState.MERGED })],
    }),
    main: { action: ActivityAction.CODE },
  },
  {
    id: '48',
    name: 'a project manager returns the task from QA',
    role: PROJECT_MANAGER,
    v1: 'TASK_RETURNED_FROM_QA',
    verdict: 'same',
    line: task({ ...observer, labels: ['qa::returned'], facts: [label('qa::returned')] }),
    main: { action: ActivityAction.RETURNED, details: [ActivityDetail.AFTER_QA] },
  },
  {
    id: '49',
    name: 'a project manager answers a task that needs information',
    role: PROJECT_MANAGER,
    v1: 'PROVIDED_REQUIREMENTS',
    verdict: 'phrase',
    line: task({
      ...observer,
      ...steady(['status::need information', 'status::testing']),
      facts: comments(2),
    }),
    main: { action: ActivityAction.COMMENTED },
    signals: { endStates: expect.arrayContaining([WorkflowState.NEEDS_INFO]) as WorkflowState[] },
  },
  {
    id: '50',
    name: 'QA passed the task of a developer today while the developer pushed',
    role: DEVELOPER,
    v1: 'DEV_PASSED_QA',
    verdict: 'rule',
    line: task({
      labels: ['status::qa passed'],
      facts: [otherFact(SourceActionKind.LABEL_ADDED, at(14), { value: 'status::qa passed' })],
      mergeRequests: [pushed(['feat: unrelated'])],
    }),
    main: { action: ActivityAction.PASSED },
    secondary: [ActivityAction.CODE],
  },
  {
    id: '51',
    name: 'an old QA passed does not outweigh code',
    role: DEVELOPER,
    v1: 'WROTE_CODE',
    verdict: 'same',
    line: task({ ...steady(['status::qa passed']), mergeRequests: [pushed(['feat: unrelated'])] }),
    main: { action: ActivityAction.CODE },
  },
  {
    id: '52',
    name: 'an old QA passed is the line of an idle day',
    role: DEVELOPER,
    v1: 'DEV_PASSED_QA',
    verdict: 'same',
    line: task(steady(['status::qa passed'])),
    main: { action: ActivityAction.STATE_ONLY, state: WorkflowState.QA_PASSED },
  },
  {
    id: '53',
    name: 'open review threads mean work on the remarks',
    role: DEVELOPER,
    v1: 'RESOLVING_REVIEW_COMMENTS',
    verdict: 'rule',
    line: task({
      mergeRequests: [
        pushed(['fix: review notes'], { reviewThreads: { total: 3, unresolved: 2 } }),
      ],
    }),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.AFTER_REVIEW] },
  },
  {
    id: '54',
    name: 'resolved review threads mean the remarks are closed',
    role: DEVELOPER,
    v1: 'RESOLVED_REVIEW_COMMENTS',
    verdict: 'rule',
    line: task({
      mergeRequests: [
        pushed(['fix: review notes'], { reviewThreads: { total: 3, unresolved: 0 } }),
      ],
    }),
    main: {
      action: ActivityAction.CODE,
      details: [ActivityDetail.AFTER_REVIEW, ActivityDetail.RESOLVED],
    },
  },
  {
    id: '55',
    name: 'code without threads or a conversation',
    role: DEVELOPER,
    v1: 'WROTE_CODE',
    verdict: 'same',
    line: task({ mergeRequests: [pushed(['feat: new code'])] }),
    main: { action: ActivityAction.CODE, details: [] },
  },
  {
    id: '56',
    name: 'a conversation outside a review is a discussion',
    role: DEVELOPER,
    v1: 'WROTE_CODE',
    verdict: 'rule',
    line: task({
      mergeRequests: [
        pushed(['feat: new code'], {
          facts: [
            otherFact(SourceActionKind.COMMENTED, at(9)),
            fact(SourceActionKind.COMMENTED, at(10)),
          ],
        }),
      ],
    }),
    main: { action: ActivityAction.CODE, details: [] },
    secondary: [ActivityAction.DISCUSSED],
  },
  {
    id: '57',
    name: 'the same conversation while the task is under review',
    role: DEVELOPER,
    v1: 'RESOLVING_REVIEW_COMMENTS',
    verdict: 'rule',
    line: task({
      labels: ['status::review'],
      mergeRequests: [
        pushed(['feat: new code'], {
          facts: [
            otherFact(SourceActionKind.COMMENTED, at(9)),
            fact(SourceActionKind.COMMENTED, at(10)),
          ],
        }),
      ],
    }),
    main: { action: ActivityAction.CODE, details: [ActivityDetail.AFTER_REVIEW] },
  },
  {
    id: '58',
    name: 'resolved threads outweigh the state of the task',
    role: DEVELOPER,
    v1: 'RESOLVED_REVIEW_COMMENTS',
    verdict: 'rule',
    line: task({
      mergeRequests: [pushed(['fix: notes'], { reviewThreads: { total: 2, unresolved: 0 } })],
    }),
    main: {
      action: ActivityAction.CODE,
      details: [ActivityDetail.AFTER_REVIEW, ActivityDetail.RESOLVED],
    },
  },
  ...[QA, DEVELOPER].map((role): Scenario => ({
    id: role === QA ? '59' : '60',
    name: `${role} reviewer of a task under review without own actions`,
    role,
    v1: role === QA ? 'QA_IN_PROGRESS' : 'STARTED_REVIEW',
    verdict: 'intentional',
    line: task({ ...observer, ...steady(['status::review']), mergeRequests: [reviewing()] }),
    main: { action: ActivityAction.STATE_ONLY, state: WorkflowState.REVIEW },
  })),
  {
    id: '61',
    name: 'a developer creates a task',
    role: DEVELOPER,
    v1: 'CREATED',
    verdict: 'same',
    line: task({ facts: [fact(SourceActionKind.OPENED, at(10))] }),
    main: { action: ActivityAction.CREATED },
  },
  {
    id: '62',
    name: 'QA files a bug',
    role: QA,
    v1: 'FOUND_BUG',
    verdict: 'same',
    line: task({
      ...observer,
      labels: ['type::bug'],
      facts: [fact(SourceActionKind.OPENED, at(10))],
    }),
    main: { action: ActivityAction.BUG_FOUND },
  },
  ...[['priority::critical'], ['priority::critical', 'type::bug']].map(
    (labels, index): Scenario => ({
      id: String(63 + index),
      name: `an urgent merge without a task: ${labels.join(', ')}`,
      role: DEVELOPER,
      v1: 'HOTFIX_DEPLOYED',
      verdict: 'phrase',
      line: { issue: null, mergeRequests: [merged({ labels })] },
      main: { action: ActivityAction.MERGED, details: [ActivityDetail.URGENT] },
    }),
  ),
  {
    id: '65',
    name: 'a hotfix task with a merge request',
    role: DEVELOPER,
    v1: 'HOTFIX_DEPLOYED',
    verdict: 'phrase',
    line: task({ labels: ['type::hotfix'], mergeRequests: [merged()] }),
    main: { action: ActivityAction.MERGED, details: [ActivityDetail.URGENT] },
    signals: { kind: TaskKind.HOTFIX },
  },
  {
    id: '66',
    name: 'a critical bug with a task is a fixed bug',
    role: DEVELOPER,
    v1: 'FIXED_BUG',
    verdict: 'phrase',
    line: task({ labels: ['type::bug', 'priority::critical'], mergeRequests: [merged()] }),
    main: { action: ActivityAction.MERGED, details: [ActivityDetail.URGENT] },
    signals: { kind: TaskKind.BUG },
  },
  ...[DEVELOPER, QA].flatMap((role): Scenario[] => [
    {
      id: '67',
      name: `${role} reviewer without actions`,
      role,
      v1: role === QA ? 'QA_IN_PROGRESS' : 'STARTED_REVIEW',
      verdict: 'intentional',
      line: task({ ...observer, ...steady(['status::review']), mergeRequests: [reviewing()] }),
      main: { action: ActivityAction.STATE_ONLY, state: WorkflowState.REVIEW },
    },
    {
      id: '68',
      name: `${role} reviewer approves`,
      role,
      v1: role === QA ? 'TESTED_AND_APPROVED' : 'APPROVED_MR',
      verdict: 'phrase',
      line: task({
        ...observer,
        ...steady(['status::review']),
        mergeRequests: [reviewing({ facts: [fact(SourceActionKind.APPROVED, at(12))] })],
      }),
      main: { action: ActivityAction.APPROVED },
    },
    {
      id: '69',
      name: `${role} reviewer leaves many remarks without approving`,
      role,
      v1: role === QA ? 'TESTED_WITH_COMMENTS' : 'REQUESTED_CHANGES',
      verdict: 'phrase',
      line: task({
        ...observer,
        ...steady(['status::review']),
        mergeRequests: [reviewing({ facts: comments(5) })],
      }),
      main: { action: ActivityAction.REVIEWED, details: [ActivityDetail.MANY] },
    },
  ]),
  {
    id: '70',
    name: 'a developer merges an own feature',
    role: DEVELOPER,
    v1: 'IMPLEMENTED_FEATURE',
    verdict: 'same',
    line: task({ labels: ['type::feature'], mergeRequests: [merged()] }),
    main: { action: ActivityAction.MERGED },
  },
  {
    id: '71',
    name: 'QA raises a bug in testing to critical',
    role: QA,
    v1: 'BLOCKED_RELEASE',
    verdict: 'rule',
    line: task({
      ...observer,
      start: ['type::bug', 'status::testing'],
      labels: ['type::bug', 'status::testing', 'priority::critical'],
      facts: [label('priority::critical')],
    }),
    main: { action: ActivityAction.RELEASE_BLOCKED },
  },
  {
    id: '72',
    name: 'a reviewer moves the task from testing back to work',
    role: DEVELOPER,
    v1: 'RETURNED_FOR_REVISION',
    verdict: 'rule',
    line: task({
      ...observer,
      start: ['status::testing'],
      labels: ['status::doing'],
      facts: [label('status::doing')],
      mergeRequests: [reviewing()],
    }),
    main: { action: ActivityAction.RETURNED, details: [ActivityDetail.AFTER_QA] },
  },
];

describe('V1 scenarios in the action engine', () => {
  it.each(SCENARIOS)('$id: $name ($v1, $verdict)', (scenario) => {
    const signals = toSignals(scenario.line, scenario.role);
    const candidates = new ActivityChains().combine(signals, createDetectors().detect(signals));
    const choice = new ActivitySelector().select(signals, candidates);

    expect(choice.main).toMatchObject(scenario.main);
    expect(signals).toMatchObject(scenario.signals ?? {});
    for (const action of scenario.secondary ?? []) {
      expect(choice.secondary.map((candidate) => candidate.action)).toContain(action);
    }
  });

  it('adds up to the analysis of the V1 scenarios', () => {
    const verdicts = SCENARIOS.reduce<Record<string, number>>(
      (total, scenario) => ({ ...total, [scenario.verdict]: (total[scenario.verdict] ?? 0) + 1 }),
      {},
    );

    expect(SCENARIOS).toHaveLength(75);
    expect(verdicts).toEqual({ same: 35, phrase: 20, intentional: 12, rule: 8 });
  });
});
