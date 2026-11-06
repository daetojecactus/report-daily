import { SourceEventAction } from 'src/modules/application/source/source.enums';
import { WorkflowState } from 'src/modules/application/trait/trait.enums';

export const CLASSIFICATION_RESUMED_WORK_DAYS = 7;

export const CLASSIFICATION_MANY_COMMENTS = 3;

export const CLASSIFICATION_DAY_MS = 24 * 60 * 60 * 1000;

export const CLASSIFICATION_DATE_LENGTH = 10;

export const CLASSIFICATION_APPROVED_NOTE = 'approved';

export const CLASSIFICATION_NEW_BRANCH_ACTION = 'created';

export const CLASSIFICATION_BRANCH_REF_TYPE = 'branch';

export const CLASSIFICATION_TEST_COMMIT_PATTERN =
  /\b(test|tests|testing|e2e|spec|specs|autotest|autotests|pom|fixture|fixtures|cypress|playwright|selenium|тест|тесты|автотест|автотесты)\b/i;

export const CLASSIFICATION_PUSH_ACTIONS = new Set<string>([
  SourceEventAction.PUSHED_TO,
  SourceEventAction.PUSHED_NEW,
]);

export const CLASSIFICATION_OPEN_ACTIONS = new Set<string>([
  SourceEventAction.OPENED,
  SourceEventAction.CREATED,
]);

export const CLASSIFICATION_RETURNED_FROM_STATES = new Set<WorkflowState>([
  WorkflowState.REVIEW,
  WorkflowState.TESTING,
  WorkflowState.CHANGES_REQUESTED,
  WorkflowState.READY_FOR_QA,
]);

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
