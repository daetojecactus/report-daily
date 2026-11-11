import type { ItemState, SourceRefType, SourceTargetType, WorkItemType } from './source.enums';
import type { MergeRequestSnapshot, IssueSnapshot } from './source-snapshot.interface';
import type { SourceFact, CleanEvent, CleanNote, CleanLabelEvent } from './source.interface';

interface IssueReference {
  projectId: number;
  iid: number;
  title: string;
  webUrl: string;
}

export interface ReviewThreads {
  total: number;
  unresolved: number;
}

export interface GroupedMergeRequest {
  projectId: number;
  iid: number;
  title: string;
  state: ItemState;
  mergedOnReportDate: boolean;
  draft: boolean;
  webUrl: string;
  sourceBranch: string;
  labels: string[];
  createdAt: string;
  lastCommitAt: string | null;
  author: string | null;
  assignees: string[];
  reviewers: string[];
  closesIssues: IssueReference[];
  milestone: string | null;
  timeSpent: number;
  startOfDay: MergeRequestSnapshot;
  facts: SourceFact[];
  events: CleanEvent[];
  notes: CleanNote[];
  labelEvents: CleanLabelEvent[];
  reviewThreads: ReviewThreads;
}

export interface GroupedIssue {
  projectId: number;
  iid: number;
  title: string;
  state: ItemState;
  closedOnReportDate: boolean;
  webUrl: string;
  workItemType: WorkItemType | null;
  labels: string[];
  createdAt: string;
  assignees: string[];
  status: string | null;
  milestone: string | null;
  iteration: string | null;
  weight: number | null;
  timeSpent: number;
  startOfDay: IssueSnapshot;
  facts: SourceFact[];
  events: CleanEvent[];
  notes: CleanNote[];
  labelEvents: CleanLabelEvent[];
  mergeRequests: GroupedMergeRequest[];
  pushes: StandalonePush[];
}

export interface StandalonePush {
  projectId: number;
  ref: string | null;
  refType: SourceRefType;
  mainBranch: boolean;
  events: CleanEvent[];
}

export interface StandaloneEvent {
  projectId: number;
  targetType: SourceTargetType;
  title: string;
  events: CleanEvent[];
}

export interface SourceProject {
  id: number;
  name: string;
  path: string;
  webUrl: string;
}

export interface GroupedDailyData {
  projects: SourceProject[];
  issues: GroupedIssue[];
  standaloneMergeRequests: GroupedMergeRequest[];
  standalonePushes: StandalonePush[];
  standaloneEvents: StandaloneEvent[];
}
