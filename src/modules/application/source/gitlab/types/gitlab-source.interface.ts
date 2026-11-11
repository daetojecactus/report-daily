import type { DayRange } from 'src/common/types/date.interface';
import type { GitLabLabelAction } from 'src/modules/vendors/gitlab/types/gitlab.enums';
import type {
  GitLabAuthor,
  GitLabCommit,
  GitLabProject,
} from 'src/modules/vendors/gitlab/types/gitlab.interface';
import type { GitLabEvent } from 'src/modules/vendors/gitlab/types/gitlab-event.interface';
import type {
  GitLabIssue,
  GitLabMergeRequest,
} from 'src/modules/vendors/gitlab/types/gitlab-issue.interface';
import type {
  GitLabLabelEvent,
  GitLabNote,
  GitLabStateEvent,
  GitLabWeightEvent,
} from 'src/modules/vendors/gitlab/types/gitlab-history.interface';
import type { SourceActionKind, SourceRefType, SourceTargetType } from '../../types/source.enums';

export interface SourceItem {
  projectId: number;
  iid: number;
}

export interface SourceBranch {
  projectId: number;
  branch: string;
}

export interface SourceRef {
  projectId: number;
  ref: string | null;
  refType: SourceRefType;
}

interface SourcePlanEvent {
  name: string;
  action: GitLabLabelAction;
  user: GitLabAuthor;
  created_at: string;
}

export interface SourcePlanHistory {
  current: string | null;
  events: SourcePlanEvent[];
}

export interface SourceTarget {
  projectId: number;
  targetType: SourceTargetType;
  id: number | string;
  title: string;
}

export interface SourceLinkReference {
  path: string;
  iid: number;
  times: number[];
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
  refs: Map<string, SourceEvents<SourceRef>>;
  targets: Map<string, SourceEvents<SourceTarget>>;
}

export interface SourceLinks {
  issues: Map<string, GitLabIssue>;
  mainIssues: Map<string, string>;
  pushIssues: Map<string, string>;
}

export interface MergeRequestActivity {
  mergeRequest: GitLabMergeRequest;
  closingIssues: GitLabIssue[];
  events: GitLabEvent[];
  notes: GitLabNote[];
  labelEvents: GitLabLabelEvent[];
  stateEvents: GitLabStateEvent[];
  milestones: SourcePlanHistory;
  commits: GitLabCommit[];
}

export interface IssueActivity {
  issue: GitLabIssue;
  events: GitLabEvent[];
  notes: GitLabNote[];
  labelEvents: GitLabLabelEvent[];
  stateEvents: GitLabStateEvent[];
  milestones: SourcePlanHistory;
  iterations: SourcePlanHistory;
  weightEvents: GitLabWeightEvent[];
  mergeRequests: MergeRequestActivity[];
  pushes: SourceEvents<SourceBranch>[];
}

export interface DayActivity {
  projects: GitLabProject[];
  issues: IssueActivity[];
  mergeRequests: MergeRequestActivity[];
  pushes: SourceEvents<SourceBranch>[];
  directPushes: SourceEvents<SourceBranch>[];
  refs: SourceEvents<SourceRef>[];
  targets: SourceEvents<SourceTarget>[];
  pushCommits: Map<number, GitLabCommit[]>;
}

export interface SourceEmployee {
  id: number;
  username: string;
}

export interface SourceBuildContext {
  day: DayRange;
  employee: SourceEmployee;
  pushCommits: Map<number, GitLabCommit[]>;
  reciprocalNotes: Set<number>;
}

export type SourceDayIndex = Record<string, { issues: number[]; mergeRequests: number[] }>;

export interface SourceHiddenItems {
  issues: SourceItem[];
  mergeRequests: SourceItem[];
}
