import type { DayRange } from 'src/common/interfaces/date.interface';
import type {
  GitLabLabelAction,
  GitLabState,
} from 'src/modules/vendors/gitlab/gitlab.enums';
import type {
  GitLabCommit,
  GitLabEvent,
  GitLabIssue,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabNote,
  GitLabProject,
  GitLabStateEvent,
} from 'src/modules/vendors/gitlab/gitlab.interface';
import type { SourceActionKind } from './source.enums';

export interface SourceItem {
  projectId: number;
  iid: number;
}

export interface SourceBranch {
  projectId: number;
  branch: string;
}

export interface SourceUserChange {
  added: string;
  removed: string;
}

export interface SourceNoteAction {
  pattern: RegExp;
  kind: SourceActionKind;
}

export interface SourceEvents<T> {
  target: T;
  events: GitLabEvent[];
}

export interface SourceEventGroups {
  issues: Map<string, SourceEvents<SourceItem>>;
  mergeRequests: Map<string, SourceEvents<SourceItem>>;
  pushes: Map<string, SourceEvents<SourceBranch>>;
}

export interface SourceLinks {
  issues: Map<string, GitLabIssue>;
  mainIssues: Map<string, string>;
}

export interface MergeRequestActivity {
  mergeRequest: GitLabMergeRequest;
  closingIssues: GitLabIssue[];
  events: GitLabEvent[];
  notes: GitLabNote[];
  labelEvents: GitLabLabelEvent[];
  stateEvents: GitLabStateEvent[];
  commits: GitLabCommit[];
}

export interface IssueActivity {
  issue: GitLabIssue;
  events: GitLabEvent[];
  notes: GitLabNote[];
  labelEvents: GitLabLabelEvent[];
  stateEvents: GitLabStateEvent[];
  mergeRequests: MergeRequestActivity[];
}

export interface DayActivity {
  projects: GitLabProject[];
  issues: IssueActivity[];
  mergeRequests: MergeRequestActivity[];
  pushes: SourceEvents<SourceBranch>[];
  pushCommits: Map<number, GitLabCommit[]>;
}

export interface SourceBuildContext {
  day: DayRange;
  userId: number;
  pushCommits: Map<number, GitLabCommit[]>;
}

export interface SourceAction {
  kind: SourceActionKind;
  at: string;
  value: string | null;
  users: string[];
}

export interface CleanCommit {
  id: string;
  title: string;
}

export interface CleanPushData {
  commitCount: number;
  action: string;
  refType: string;
  ref: string | null;
  commitTitle: string | null;
  commits: CleanCommit[];
}

export interface CleanEvent {
  id: number;
  projectId: number | null;
  actionName: string;
  targetType: string | null;
  targetTitle: string | null;
  createdAt: string;
  pushData?: CleanPushData;
  noteBody?: string;
}

export interface CleanNote {
  id: number;
  body: string;
  authorUsername: string;
  authorName: string;
  createdAt: string;
  system: boolean;
  noteableType: string;
  resolvable: boolean;
  resolved?: boolean;
}

export interface CleanLabelEvent {
  id: number;
  labelName: string;
  action: GitLabLabelAction;
  createdAt: string;
  username: string;
}

export interface IssueReference {
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
  state: GitLabState;
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
  actions: SourceAction[];
  events: CleanEvent[];
  notes: CleanNote[];
  labelEvents: CleanLabelEvent[];
  reviewThreads: ReviewThreads;
}

export interface GroupedIssue {
  projectId: number;
  iid: number;
  title: string;
  state: GitLabState;
  closedOnReportDate: boolean;
  webUrl: string;
  labels: string[];
  createdAt: string;
  assignees: string[];
  status: string | null;
  actions: SourceAction[];
  events: CleanEvent[];
  notes: CleanNote[];
  labelEvents: CleanLabelEvent[];
  mergeRequests: GroupedMergeRequest[];
}

export interface StandalonePush {
  projectId: number;
  branch: string;
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
}
