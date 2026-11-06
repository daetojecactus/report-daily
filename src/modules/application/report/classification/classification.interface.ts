import type { ItemState } from 'src/modules/application/source/source.enums';
import type {
  GroupedIssue,
  GroupedMergeRequest,
  SourceProject,
  StandalonePush,
} from 'src/modules/application/source/source.interface';
import type {
  Priority,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import type { JobRole } from 'src/modules/application/user/user.enums';
import type { ActivityAction, EngagementLevel, TaskRole } from './classification.enums';

export interface ClassificationEmployee {
  username: string;
  role: JobRole;
}

export interface TaskDates {
  mergeRequestCreatedAt: string | null;
  mergeRequestLastCommitAt: string | null;
  reportDate: string;
}

export interface TaskTraitSignals {
  kinds: TaskKind[];
  priority: Priority | null;
  currentState: WorkflowState | null;
  previousState: WorkflowState | null;
  activeStates: WorkflowState[];
  statesSetByEmployee: WorkflowState[];
  priorityEscalatedByEmployee: boolean;
  flags: TaskFlag[];
  flagsSetByEmployee: TaskFlag[];
  needsRebaseResolved: boolean;
}

export interface TaskActivity {
  issueState: ItemState | null;
  mergeRequestState: ItemState | null;
  issueClosedOnReportDate: boolean;
  mergeRequestMergedOnReportDate: boolean;
  issueActions: string[];
  mergeRequestActions: string[];
  issueCommentsFromEmployee: number;
  mergeRequestCommentsFromEmployee: number;
  mergeRequestCommentsFromOthers: number;
  mergeRequestCommitCount: number;
  commitTitles: string[];
  reviewThreadCount: number;
  unresolvedReviewThreadCount: number;
}

export interface TaskApprovals {
  employeeApproved: boolean;
  otherApprovers: string[];
}

export interface TaskContextData {
  role: JobRole;
  taskRole: TaskRole;
  isMergeRequestAuthor: boolean;
  kind: TaskKind | null;
  dates: TaskDates;
  traits: TaskTraitSignals;
  activity: TaskActivity;
  approvals: TaskApprovals;
}

export interface EngagementResult {
  score: number;
  level: EngagementLevel;
}

export interface ClassificationResult {
  action: ActivityAction;
  kind: TaskKind | null;
}

export interface ClassifiedIssue extends GroupedIssue {
  classification: ClassificationResult;
}

export interface ClassifiedMergeRequest extends GroupedMergeRequest {
  classification: ClassificationResult;
}

export interface ClassifiedPush extends StandalonePush {
  classification: ClassificationResult;
}

export interface ClassifiedDay {
  projects: SourceProject[];
  issues: ClassifiedIssue[];
  standaloneMergeRequests: ClassifiedMergeRequest[];
  standalonePushes: ClassifiedPush[];
}
