import {
  GitLabIssueState,
  GitLabMergeRequestState,
  ParsedEventType,
} from 'src/common/enums/gitlab.enum';

export interface ParsedEvent {
  type: ParsedEventType;
  projectId: number;
  iid?: number;
  branch?: string;
}

//очищенное событие без лишних данных (аватары и тд)
export interface CleanEvent {
  id: number;
  projectId: number;
  actionName: string;
  targetType: string | null;
  targetTitle: string | null;
  createdAt: string;
  pushData?: {
    commitCount: number;
    action: string;
    refType: string;
    ref: string;
    commitTitle: string | null;
  };
  noteBody?: string;
}

//очищенный комментарий
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

//очищенное событие смены лейбла
export interface CleanLabelEvent {
  id: number;
  labelName: string;
  action: 'add' | 'remove';
  createdAt: string;
  username: string;
}

export interface GroupedMergeRequest {
  projectId: number;
  iid: number;
  title: string;
  state: GitLabMergeRequestState;
  webUrl: string;
  sourceBranch: string;
  labels: string[];
  createdAt: string;
  assignee: string | null;
  reviewers: string[];
  events: CleanEvent[];
  notes: CleanNote[];
  labelEvents: CleanLabelEvent[];
}

export interface GroupedIssue {
  projectId: number;
  iid: number;
  title: string;
  state: GitLabIssueState;
  webUrl: string;
  labels: string[];
  createdAt: string;
  assignee: string | null;
  events: CleanEvent[];
  notes: CleanNote[];
  labelEvents: CleanLabelEvent[];
  mergeRequests: GroupedMergeRequest[];
}

export interface StandaloneMergeRequest {
  projectId: number;
  iid: number;
  title: string;
  state: GitLabMergeRequestState;
  webUrl: string;
  sourceBranch: string;
  labels: string[];
  createdAt: string;
  assignee: string | null;
  reviewers: string[];
  events: CleanEvent[];
  notes: CleanNote[];
  labelEvents: CleanLabelEvent[];
}

export interface StandalonePush {
  projectId: number;
  branch: string;
  events: CleanEvent[];
}

export interface GroupedDailyData {
  issues: GroupedIssue[];
  standaloneMergeRequests: StandaloneMergeRequest[];
  standalonePushes: StandalonePush[];
}
