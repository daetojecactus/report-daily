import { toSourceKey } from 'src/common/utils/source-name.util';
import type { SourceActionKind } from 'src/modules/application/source/source.enums';
import { ItemState } from 'src/modules/application/source/source.enums';
import type {
  CleanEvent,
  GroupedIssue,
  GroupedMergeRequest,
  SourceFact,
} from 'src/modules/application/source/source.interface';
import {
  Priority,
  TaskFlag,
  TaskKind,
  TraitDimension,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import type {
  TraitIndex,
  TraitPair,
  TraitValue,
} from 'src/modules/application/trait/trait.interface';
import type { TraitRepository } from 'src/modules/application/trait/trait.repository';
import { TraitService } from 'src/modules/application/trait/trait.service';
import { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityCodeDetector } from '../activity-code.detector';
import { ActivityLifecycleDetector } from '../activity-lifecycle.detector';
import { ActivityChains } from '../activity.chains';
import { ActivityDetectors } from '../activity.detectors';
import { ActivityEngagement } from '../activity.engagement';
import { ActivityAction } from '../activity.enums';
import type { ActivityCandidate, ActivityEmployee, ActivityLine } from '../activity.interface';
import { ActivityRules } from '../activity.rules';
import { ActivitySelector } from '../activity.selector';
import { ActivityService } from '../activity.service';
import { ActivitySignals } from '../activity.signals';

export const REPORT_DATE = '2026-08-02';

export const ME = 'dev.me';

export const OTHER = 'dev.other';

const MAPPINGS: [string, TraitDimension, TraitValue][] = [
  ['status::todo', TraitDimension.WORKFLOW_STATE, WorkflowState.PLANNED],
  ['status::sprint backlog', TraitDimension.WORKFLOW_STATE, WorkflowState.PLANNED],
  ['status::need information', TraitDimension.WORKFLOW_STATE, WorkflowState.NEEDS_INFO],
  ['status::doing', TraitDimension.WORKFLOW_STATE, WorkflowState.IN_PROGRESS],
  ['status::review', TraitDimension.WORKFLOW_STATE, WorkflowState.REVIEW],
  ['status::after review', TraitDimension.WORKFLOW_STATE, WorkflowState.CHANGES_REQUESTED],
  ['status::ready for qa', TraitDimension.WORKFLOW_STATE, WorkflowState.READY_FOR_QA],
  ['status::testing', TraitDimension.WORKFLOW_STATE, WorkflowState.TESTING],
  ['status::qa passed', TraitDimension.WORKFLOW_STATE, WorkflowState.QA_PASSED],
  ['status::hold', TraitDimension.WORKFLOW_STATE, WorkflowState.BLOCKED],
  ['In progress', TraitDimension.WORKFLOW_STATE, WorkflowState.IN_PROGRESS],
  ['Done', TraitDimension.WORKFLOW_STATE, WorkflowState.DONE],
  ['type::bug', TraitDimension.TASK_KIND, TaskKind.BUG],
  ['type::feature', TraitDimension.TASK_KIND, TaskKind.FEATURE],
  ['type::qa', TraitDimension.TASK_KIND, TaskKind.QA_INTERNAL],
  ['type::hotfix', TraitDimension.TASK_KIND, TaskKind.HOTFIX],
  ['type::maintenance', TraitDimension.TASK_KIND, TaskKind.MAINTENANCE],
  ['type::dependency', TraitDimension.TASK_KIND, TaskKind.DEPENDENCY],
  ['priority::critical', TraitDimension.PRIORITY, Priority.CRITICAL],
  ['priority::high', TraitDimension.PRIORITY, Priority.HIGH],
  ['qa::returned', TraitDimension.FLAG, TaskFlag.RETURNED_FROM_QA],
  ['needs-rebase', TraitDimension.FLAG, TaskFlag.NEEDS_REBASE],
  ['type::ignore', TraitDimension.FLAG, TaskFlag.EXCLUDE_FROM_REPORT],
  ['test::e2e required', TraitDimension.FLAG, TaskFlag.E2E_REQUIRED],
  ['test::unit', TraitDimension.FLAG, TaskFlag.UNIT_TESTS_REQUIRED],
];

export function createIndex(): TraitIndex {
  const index: TraitIndex = new Map();
  for (const [name, dimension, value] of MAPPINGS) {
    const pairs: TraitPair[] = index.get(toSourceKey(name)) ?? [];
    pairs.push({ dimension, value });
    index.set(toSourceKey(name), pairs);
  }
  return index;
}

export function at(hour: number, minute = 0, second = 0) {
  const time = [hour, minute, second].map((part) => String(part).padStart(2, '0')).join(':');
  return `${REPORT_DATE}T${time}.000Z`;
}

export function fact(
  kind: SourceActionKind,
  time: string,
  overrides: Partial<SourceFact> = {},
): SourceFact {
  return { kind, at: time, actor: ME, own: true, value: null, users: [], ...overrides };
}

export function otherFact(
  kind: SourceActionKind,
  time: string,
  overrides: Partial<SourceFact> = {},
): SourceFact {
  return fact(kind, time, { actor: OTHER, own: false, ...overrides });
}

export function pushEvent(time: string, titles: string[] = ['fix: the login']): CleanEvent {
  return {
    id: 1,
    projectId: 1,
    actionName: 'pushed to',
    targetType: null,
    targetTitle: null,
    createdAt: time,
    pushData: {
      commitCount: titles.length,
      action: 'pushed',
      refType: 'branch',
      ref: '12-login',
      commitTitle: titles.at(-1) ?? null,
      commits: titles.map((title, index) => ({ id: String(index), title })),
    },
  };
}

export function createMergeRequest(
  overrides: Partial<GroupedMergeRequest> = {},
): GroupedMergeRequest {
  return {
    projectId: 1,
    iid: 5,
    title: 'Merge request 5',
    state: ItemState.OPENED,
    mergedOnReportDate: false,
    draft: false,
    webUrl: 'https://gitlab.example.com/group/project-1/-/merge_requests/5',
    sourceBranch: '12-login',
    labels: [],
    createdAt: '2026-07-30T09:00:00.000Z',
    lastCommitAt: null,
    author: ME,
    assignees: [ME],
    reviewers: [],
    closesIssues: [],
    startOfDay: {
      state: ItemState.OPENED,
      labels: [],
      assignees: [ME],
      status: null,
      reviewers: [],
      draft: false,
    },
    facts: [],
    events: [],
    notes: [],
    labelEvents: [],
    reviewThreads: { total: 0, unresolved: 0 },
    ...overrides,
  };
}

export function othersMergeRequest(
  overrides: Partial<GroupedMergeRequest> = {},
): GroupedMergeRequest {
  return createMergeRequest({ author: OTHER, assignees: [OTHER], ...overrides });
}

export function createIssue(overrides: Partial<GroupedIssue> = {}): GroupedIssue {
  return {
    projectId: 1,
    iid: 12,
    title: 'Issue 12',
    state: ItemState.OPENED,
    closedOnReportDate: false,
    webUrl: 'https://gitlab.example.com/group/project-1/-/issues/12',
    labels: [],
    createdAt: '2026-07-30T09:00:00.000Z',
    assignees: [ME],
    status: null,
    startOfDay: { state: ItemState.OPENED, labels: [], assignees: [ME], status: null },
    facts: [],
    events: [],
    notes: [],
    labelEvents: [],
    mergeRequests: [],
    ...overrides,
  };
}

export function createSignals() {
  return new ActivitySignals(
    new TraitService({} as TraitRepository),
    new ActivityEngagement(),
    new ActivityRules(),
  );
}

export function createService() {
  return new ActivityService(
    createSignals(),
    createDetectors(),
    new ActivityChains(),
    new ActivitySelector(),
  );
}

export function createDetectors() {
  return new ActivityDetectors(new ActivityLifecycleDetector(), new ActivityCodeDetector());
}

export function toSignals(line: ActivityLine, role = JobRole.DEVELOPER) {
  const employee: ActivityEmployee = { username: ME, role };
  return createSignals().build(line, employee, createIndex());
}

export function detect(line: ActivityLine, role = JobRole.DEVELOPER) {
  return createDetectors().detect(toSignals(line, role));
}

export function combine(line: ActivityLine, role = JobRole.DEVELOPER) {
  const signals = toSignals(line, role);
  return new ActivityChains().combine(signals, createDetectors().detect(signals));
}

export function choose(line: ActivityLine, role = JobRole.DEVELOPER) {
  const signals = toSignals(line, role);
  const candidates = new ActivityChains().combine(signals, createDetectors().detect(signals));
  return new ActivitySelector().select(signals, candidates);
}

export function issueLine(issue = createIssue()): ActivityLine {
  return { issue, mergeRequests: issue.mergeRequests, push: null };
}

export function summarize(candidates: ActivityCandidate[]) {
  return candidates
    .filter((candidate) => candidate.action !== ActivityAction.STATE_ONLY)
    .map(({ action, weight, state, details }) => ({ action, weight, state, details }));
}
