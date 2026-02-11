import {
  GitLabIssueState,
  GitLabMergeRequestState,
  ParsedEventType,
} from 'src/common/enums/gitlab.enum';
import { GitLabEvent } from 'src/modules/vendors/gitlab/gitlab.types';

export interface ParsedEvent {
  type: ParsedEventType;
  projectId: number;
  iid?: number;
  branch?: string;
}

export interface GroupedMergeRequest {
  projectId: number;
  iid: number;
  title: string;
  state: GitLabMergeRequestState;
  webUrl: string;
  sourceBranch: string;
  labels: string[];
  events: GitLabEvent[];
}

export interface GroupedIssue {
  projectId: number;
  iid: number;
  title: string;
  state: GitLabIssueState;
  webUrl: string;
  labels: string[];
  events: GitLabEvent[];
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
  events: GitLabEvent[];
}

export interface StandalonePush {
  projectId: number;
  branch: string;
  events: GitLabEvent[];
}

export interface GroupedDailyData {
  issues: GroupedIssue[];
  standaloneMergeRequests: StandaloneMergeRequest[];
  standalonePushes: StandalonePush[];
}
