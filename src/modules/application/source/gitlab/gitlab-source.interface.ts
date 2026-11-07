import type { DayRange } from 'src/common/interfaces/date.interface';
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
import type { SourceActionKind } from '../source.enums';

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
  pushIssues: Map<string, string>;
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
  pushes: SourceEvents<SourceBranch>[];
}

export interface DayActivity {
  projects: GitLabProject[];
  issues: IssueActivity[];
  mergeRequests: MergeRequestActivity[];
  pushes: SourceEvents<SourceBranch>[];
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
}

export type SourceDayIndex = Record<string, { issues: number[]; mergeRequests: number[] }>;

export interface SourceHiddenItems {
  issues: SourceItem[];
  mergeRequests: SourceItem[];
}
