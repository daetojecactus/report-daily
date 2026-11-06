import { toSourceKey } from 'src/common/utils/source-name.util';
import { ItemState, LabelAction } from 'src/modules/application/source/source.enums';
import type {
  CleanEvent,
  CleanLabelEvent,
  CleanNote,
  GroupedIssue,
  GroupedMergeRequest,
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
import { ClassificationBuilder } from '../classification.builder';
import { ClassificationResolver } from '../classification.resolver';
import { DeveloperRules } from '../rules/developer.rules';
import { ManagerRules } from '../rules/manager.rules';
import { QaInternalRules } from '../rules/qa-internal.rules';
import { QaRules } from '../rules/qa.rules';
import { TaskContext } from '../classification.context';
import { TaskRole } from '../classification.enums';
import type { TaskContextData } from '../classification.interface';

export const REPORT_DATE = '2026-08-02';

export const USERNAME = 'qa.user';

const V1_LABELS: [string, TraitDimension, TraitValue][] = [
  ['status::todo', TraitDimension.WORKFLOW_STATE, WorkflowState.PLANNED],
  ['status::sprint backlog', TraitDimension.WORKFLOW_STATE, WorkflowState.PLANNED],
  ['status::doing', TraitDimension.WORKFLOW_STATE, WorkflowState.IN_PROGRESS],
  ['status::review', TraitDimension.WORKFLOW_STATE, WorkflowState.REVIEW],
  ['status::after review', TraitDimension.WORKFLOW_STATE, WorkflowState.CHANGES_REQUESTED],
  ['status::ready for qa', TraitDimension.WORKFLOW_STATE, WorkflowState.READY_FOR_QA],
  ['status::testing', TraitDimension.WORKFLOW_STATE, WorkflowState.TESTING],
  ['status::qa in progress', TraitDimension.WORKFLOW_STATE, WorkflowState.TESTING],
  ['status::qa passed', TraitDimension.WORKFLOW_STATE, WorkflowState.QA_PASSED],
  ['status::need information', TraitDimension.WORKFLOW_STATE, WorkflowState.NEEDS_INFO],
  ['status::hold', TraitDimension.WORKFLOW_STATE, WorkflowState.BLOCKED],
  ['status::frontend', TraitDimension.WORKFLOW_STATE, WorkflowState.HANDOFF],
  ['type::hotfix', TraitDimension.TASK_KIND, TaskKind.HOTFIX],
  ['type::bug', TraitDimension.TASK_KIND, TaskKind.BUG],
  ['type::feature', TraitDimension.TASK_KIND, TaskKind.FEATURE],
  ['type::maintenance', TraitDimension.TASK_KIND, TaskKind.MAINTENANCE],
  ['type::epic', TraitDimension.TASK_KIND, TaskKind.EPIC],
  ['type::qa', TraitDimension.TASK_KIND, TaskKind.QA_INTERNAL],
  ['type::e2e', TraitDimension.TASK_KIND, TaskKind.TEST_AUTOMATION],
  ['hotfix', TraitDimension.TASK_KIND, TaskKind.HOTFIX],
  ['bug', TraitDimension.TASK_KIND, TaskKind.BUG],
  ['feature', TraitDimension.TASK_KIND, TaskKind.FEATURE],
  ['maintenance', TraitDimension.TASK_KIND, TaskKind.MAINTENANCE],
  ['epic', TraitDimension.TASK_KIND, TaskKind.EPIC],
  ['type::ignore', TraitDimension.FLAG, TaskFlag.EXCLUDE_FROM_REPORT],
  ['priority::critical', TraitDimension.PRIORITY, Priority.CRITICAL],
  ['priority::high', TraitDimension.PRIORITY, Priority.HIGH],
  ['priority::medium', TraitDimension.PRIORITY, Priority.MEDIUM],
  ['priority::low', TraitDimension.PRIORITY, Priority.LOW],
  ['qa::returned to development', TraitDimension.FLAG, TaskFlag.RETURNED_FROM_QA],
  ['test::e2e required', TraitDimension.FLAG, TaskFlag.E2E_REQUIRED],
  ['test::unit', TraitDimension.FLAG, TaskFlag.UNIT_TESTS_REQUIRED],
  ['needs-rebase', TraitDimension.FLAG, TaskFlag.NEEDS_REBASE],
];

export function createV1TraitIndex(): TraitIndex {
  const index: TraitIndex = new Map();
  for (const [name, dimension, value] of V1_LABELS) {
    const pairs: TraitPair[] = index.get(toSourceKey(name)) ?? [];
    pairs.push({ dimension, value });
    index.set(toSourceKey(name), pairs);
  }
  return index;
}

export function createBuilder() {
  return new ClassificationBuilder(new TraitService({} as TraitRepository));
}

export function createResolver() {
  const qaInternalRules = new QaInternalRules();
  const developerRules = new DeveloperRules(qaInternalRules);
  return new ClassificationResolver(
    new ManagerRules(),
    new QaRules(qaInternalRules, developerRules),
    developerRules,
    qaInternalRules,
  );
}

export function createEvent(overrides: Partial<CleanEvent> = {}): CleanEvent {
  return {
    id: 1,
    projectId: 1,
    actionName: 'opened',
    targetType: null,
    targetTitle: null,
    createdAt: `${REPORT_DATE}T12:00:00.000Z`,
    ...overrides,
  };
}

export function createLabelEvent(
  overrides: Partial<CleanLabelEvent> & { labelName: string },
): CleanLabelEvent {
  return {
    id: 1,
    action: LabelAction.ADD,
    createdAt: `${REPORT_DATE}T10:00:00.000Z`,
    username: USERNAME,
    ...overrides,
  };
}

export function createNote(overrides: Partial<CleanNote> = {}): CleanNote {
  return {
    id: 1,
    body: 'comment',
    authorUsername: USERNAME,
    authorName: USERNAME,
    createdAt: `${REPORT_DATE}T11:00:00.000Z`,
    system: false,
    noteableType: 'MergeRequest',
    resolvable: false,
    ...overrides,
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
    sourceBranch: '10-branch',
    labels: [],
    createdAt: `${REPORT_DATE}T09:00:00.000Z`,
    lastCommitAt: null,
    author: 'dev.author',
    assignees: ['dev.author'],
    reviewers: [],
    closesIssues: [],
    actions: [],
    events: [],
    notes: [],
    labelEvents: [],
    reviewThreads: { total: 0, unresolved: 0 },
    ...overrides,
  };
}

export function createIssue(overrides: Partial<GroupedIssue> = {}): GroupedIssue {
  return {
    projectId: 1,
    iid: 10,
    title: 'Issue 10',
    state: ItemState.OPENED,
    closedOnReportDate: false,
    webUrl: 'https://gitlab.example.com/group/project-1/-/issues/10',
    labels: [],
    createdAt: `${REPORT_DATE}T09:00:00.000Z`,
    assignees: [],
    status: null,
    actions: [],
    events: [],
    notes: [],
    labelEvents: [],
    mergeRequests: [],
    ...overrides,
  };
}

export interface ContextOverrides {
  role?: JobRole;
  taskRole?: TaskRole;
  kind?: TaskContextData['kind'];
  isMergeRequestAuthor?: boolean;
  dates?: Partial<TaskContextData['dates']>;
  traits?: Partial<TaskContextData['traits']>;
  activity?: Partial<TaskContextData['activity']>;
  approvals?: Partial<TaskContextData['approvals']>;
}

export function createContext(overrides: ContextOverrides = {}) {
  return new TaskContext({
    role: overrides.role ?? JobRole.DEVELOPER,
    taskRole: overrides.taskRole ?? TaskRole.ASSIGNEE,
    isMergeRequestAuthor: overrides.isMergeRequestAuthor ?? false,
    kind: overrides.kind ?? null,
    dates: {
      mergeRequestCreatedAt: null,
      mergeRequestLastCommitAt: null,
      reportDate: REPORT_DATE,
      ...overrides.dates,
    },
    traits: {
      kinds: [],
      priority: null,
      currentState: null,
      previousState: null,
      activeStates: [],
      statesSetByEmployee: [],
      priorityEscalatedByEmployee: false,
      flags: [],
      flagsSetByEmployee: [],
      needsRebaseResolved: false,
      ...overrides.traits,
    },
    activity: {
      issueState: null,
      mergeRequestState: null,
      issueClosedOnReportDate: false,
      mergeRequestMergedOnReportDate: false,
      issueActions: [],
      mergeRequestActions: [],
      issueCommentsFromEmployee: 0,
      mergeRequestCommentsFromEmployee: 0,
      mergeRequestCommentsFromOthers: 0,
      mergeRequestCommitCount: 0,
      commitTitles: [],
      reviewThreadCount: 0,
      unresolvedReviewThreadCount: 0,
      ...overrides.activity,
    },
    approvals: {
      employeeApproved: false,
      otherApprovers: [],
      ...overrides.approvals,
    },
  });
}
