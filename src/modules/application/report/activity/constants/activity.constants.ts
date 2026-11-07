import { SourceActionKind } from 'src/modules/application/source/source.enums';
import { WorkflowState } from 'src/modules/application/trait/trait.enums';
import { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityAction, ActivityDetail, ActivityTier } from '../activity.enums';
import type { ActivityRoleFocus } from '../activity.interface';

export const ACTIVITY_WEIGHTS = {
  MERGED: 950,
  CLOSED: 940,
  MERGED_OTHER: 900,
  COMPLETED: 890,
  REOPENED: 880,
  APPROVED: 780,
  RETURNED: 770,
  REVIEWED_MANY: 760,
  BUG_FOUND: 750,
  REVIEWED: 720,
  UNAPPROVED: 700,
  ESCALATED: 600,
  CODE: 300,
  REQUIREMENTS: 320,
  TOOK_REVIEW: 290,
  CREATED: 220,
  DISCUSSED: 200,
  ASSIGNED: 200,
  HELPED: 180,
  EDITED: 150,
  COMMENTED: 100,
  STATE_ONLY: 50,
} as const;

export const ACTIVITY_CODE_WEIGHTS: Partial<Record<ActivityDetail, number>> = {
  [ActivityDetail.AFTER_REVIEW]: 350,
  [ActivityDetail.RESOLVED]: 350,
  [ActivityDetail.AFTER_QA]: 345,
  [ActivityDetail.REBASE]: 340,
  [ActivityDetail.TESTS]: 330,
  [ActivityDetail.STARTED]: 320,
  [ActivityDetail.RESUMED]: 315,
  [ActivityDetail.REFACTORING]: 310,
};

export const ACTIVITY_TIERS: { tier: ActivityTier; from: number }[] = [
  { tier: ActivityTier.OUTCOME, from: 800 },
  { tier: ActivityTier.CHECK, from: 700 },
  { tier: ActivityTier.TRANSITION, from: 500 },
  { tier: ActivityTier.WORK, from: 250 },
  { tier: ActivityTier.PARTICIPATION, from: 100 },
  { tier: ActivityTier.CONTEXT, from: 1 },
];

export const ACTIVITY_ROLE_BONUS = 30;

export const ACTIVITY_CHAIN_BONUS = 5;

export const ACTIVITY_BEFORE_DAY = 0;

export const ACTIVITY_ROLE_FOCUS: Record<JobRole, ActivityRoleFocus> = {
  [JobRole.DEVELOPER]: { actions: [ActivityAction.CODE, ActivityAction.MERGED], states: [] },
  [JobRole.QA]: {
    actions: [
      ActivityAction.APPROVED,
      ActivityAction.RETURNED,
      ActivityAction.REVIEWED,
      ActivityAction.BUG_FOUND,
    ],
    states: [WorkflowState.TESTING, WorkflowState.QA_PASSED],
  },
  [JobRole.PROJECT_MANAGER]: {
    actions: [ActivityAction.CLOSED, ActivityAction.CREATED, ActivityAction.ESCALATED],
    states: [WorkflowState.PLANNED],
  },
  [JobRole.SYSTEM_ANALYST]: {
    actions: [ActivityAction.REQUIREMENTS, ActivityAction.CREATED],
    states: [WorkflowState.ANALYSIS, WorkflowState.DESIGN, WorkflowState.NEEDS_INFO],
  },
  [JobRole.DEVOPS]: {
    actions: [],
    states: [WorkflowState.STAGING, WorkflowState.RELEASED, WorkflowState.READY_FOR_RELEASE],
  },
};

export const ACTIVITY_UNDO_MS = 2 * 60 * 1000;

export const ACTIVITY_SETUP_MS = 3 * 60 * 1000;

export const ACTIVITY_MERGE_CLOSE_MS = 2 * 60 * 1000;

export const ACTIVITY_AUTO_STATUS_MS = 5 * 1000;

export const ACTIVITY_SWAP_MS = 5 * 1000;

export const ACTIVITY_RESUMED_WORK_DAYS = 7;

export const ACTIVITY_DAY_MS = 24 * 60 * 60 * 1000;

export const ACTIVITY_MANY_COMMENTS = 3;

export const ACTIVITY_TEST_COMMIT_PATTERN =
  /(?<![\p{L}\p{N}_])(?:test|tests|testing|e2e|spec|specs|autotest|autotests|pom|fixture|fixtures|cypress|playwright|selenium|тест|тесты|автотест|автотесты)(?![\p{L}\p{N}_])/iu;

export const ACTIVITY_OPPOSITE_FACTS = new Map<SourceActionKind, SourceActionKind>([
  [SourceActionKind.LABEL_ADDED, SourceActionKind.LABEL_REMOVED],
  [SourceActionKind.LABEL_REMOVED, SourceActionKind.LABEL_ADDED],
  [SourceActionKind.ASSIGNED, SourceActionKind.UNASSIGNED],
  [SourceActionKind.UNASSIGNED, SourceActionKind.ASSIGNED],
  [SourceActionKind.REVIEW_REQUESTED, SourceActionKind.REVIEW_REQUEST_REMOVED],
  [SourceActionKind.REVIEW_REQUEST_REMOVED, SourceActionKind.REVIEW_REQUESTED],
  [SourceActionKind.APPROVED, SourceActionKind.UNAPPROVED],
  [SourceActionKind.UNAPPROVED, SourceActionKind.APPROVED],
  [SourceActionKind.MARKED_DRAFT, SourceActionKind.MARKED_READY],
  [SourceActionKind.MARKED_READY, SourceActionKind.MARKED_DRAFT],
  [SourceActionKind.CLOSED, SourceActionKind.REOPENED],
  [SourceActionKind.REOPENED, SourceActionKind.CLOSED],
]);

export const ACTIVITY_SWAP_FACTS = new Map<SourceActionKind, SourceActionKind>([
  [SourceActionKind.LABEL_REMOVED, SourceActionKind.LABEL_ADDED],
  [SourceActionKind.UNASSIGNED, SourceActionKind.ASSIGNED],
  [SourceActionKind.REVIEW_REQUEST_REMOVED, SourceActionKind.REVIEW_REQUESTED],
]);

export const ACTIVITY_SETUP_FACTS = new Set<SourceActionKind>([
  SourceActionKind.LABEL_ADDED,
  SourceActionKind.LABEL_REMOVED,
  SourceActionKind.STATUS_SET,
  SourceActionKind.ASSIGNED,
  SourceActionKind.UNASSIGNED,
]);

export const ACTIVITY_EDIT_FACTS = new Set<SourceActionKind>([
  SourceActionKind.DESCRIPTION_CHANGED,
  SourceActionKind.TITLE_CHANGED,
]);

export const ACTIVITY_LIFECYCLE_FACTS = new Set<SourceActionKind>([
  SourceActionKind.OPENED,
  SourceActionKind.CLOSED,
  SourceActionKind.REOPENED,
  SourceActionKind.MERGED,
]);

export const ACTIVITY_BRANCH_PUSH_ACTION = 'pushed new';

export const ACTIVITY_PUSH_ACTIONS = new Set(['pushed to', ACTIVITY_BRANCH_PUSH_ACTION]);

export const ACTIVITY_CODE_FACTS = new Set<SourceActionKind>([
  SourceActionKind.PUSHED,
  SourceActionKind.BRANCH_CREATED,
  SourceActionKind.DIFF_LINE_CHANGED,
]);

export const ACTIVITY_CODE_CHANGE_FACTS = new Set<SourceActionKind>([
  SourceActionKind.PUSHED,
  SourceActionKind.DIFF_LINE_CHANGED,
]);

export const ACTIVITY_REVIEW_FACTS = new Set<SourceActionKind>([
  SourceActionKind.COMMENTED,
  SourceActionKind.REVIEW_SUBMITTED,
  SourceActionKind.THREADS_RESOLVED,
]);

export const ACTIVITY_COMMENT_FACTS = new Set<SourceActionKind>([
  SourceActionKind.COMMENTED,
  SourceActionKind.REVIEW_SUBMITTED,
]);

export const ACTIVITY_EDIT_DETAILS = new Map<SourceActionKind, ActivityDetail>([
  [SourceActionKind.TITLE_CHANGED, ActivityDetail.TITLE],
  [SourceActionKind.DESCRIPTION_CHANGED, ActivityDetail.DESCRIPTION],
  [SourceActionKind.LABEL_ADDED, ActivityDetail.LABELS],
  [SourceActionKind.LABEL_REMOVED, ActivityDetail.LABELS],
  [SourceActionKind.STATUS_SET, ActivityDetail.STATUS],
  [SourceActionKind.MARKED_DRAFT, ActivityDetail.DRAFT],
  [SourceActionKind.REVIEW_REQUEST_REMOVED, ActivityDetail.REVIEWERS],
]);

export const ACTIVITY_DEPENDENCY_BRANCH_PATTERN = /^(?:renovate|dependabot)[/-]/i;

export const ENGAGEMENT_WEIGHTS = {
  ASSIGNEE: 5,
  REVIEWER: 5,
  MERGE_REQUEST_AUTHOR: 4,
  MERGED: 4,
  ISSUE_AUTHOR: 2,
  PER_COMMIT: 1,
  PER_COMMENT: 0.5,
  PER_STATE_CHANGE: 1,
  PRIORITY_ESCALATION: 1,
} as const;

export const ENGAGEMENT_COMMIT_CAP = 5;

export const ENGAGEMENT_COMMENT_CAP = 4;

export const ENGAGEMENT_STATE_CHANGE_CAP = 3;

export const ENGAGEMENT_THRESHOLDS = {
  PRIMARY: 5,
  SECONDARY: 2.5,
  MINOR: 0.5,
} as const;
