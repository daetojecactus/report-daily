import type { UserSource } from 'src/modules/application/user/user-source/user-source.interface';
import type {
  ItemState,
  LabelAction,
  Source,
  SourceActionKind,
  SourceRefType,
} from './source.enums';

export interface SourceFact {
  kind: SourceActionKind;
  at: string;
  actor: string | null;
  own: boolean;
  value: string | null;
  users: string[];
}

export interface ItemSnapshot {
  state: ItemState;
  labels: string[];
  assignees: string[];
  status: string | null;
}

export interface MergeRequestSnapshot extends ItemSnapshot {
  reviewers: string[];
  draft: boolean;
}

export interface CleanCommit {
  id: string;
  title: string;
}

export interface CleanPushData {
  commitCount: number;
  action: string;
  refType: SourceRefType;
  ref: string | null;
  refCount: number | null;
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
  action: LabelAction;
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
  labels: string[];
  createdAt: string;
  assignees: string[];
  status: string | null;
  startOfDay: ItemSnapshot;
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

export interface ActivitySource {
  readonly source: Source;
  collect(account: UserSource, date: string, timeZone: string): Promise<GroupedDailyData>;
}
