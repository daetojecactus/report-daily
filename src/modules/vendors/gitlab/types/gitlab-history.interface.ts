import type { GitLabLabelAction, GitLabState } from './gitlab.enums';
import type { GitLabAuthor } from './gitlab.interface';
import type { GitLabMilestone, GitLabIteration } from './gitlab-issue.interface';

export interface GitLabNote {
  id: number;
  body: string;
  author: GitLabAuthor;
  created_at: string;
  system: boolean;
  noteable_type: string;
  resolvable: boolean;
  resolved?: boolean;
  resolved_at?: string | null;
}

export interface GitLabLabelEvent {
  id: number;
  user: GitLabAuthor;
  created_at: string;
  label: { name: string } | null;
  action: GitLabLabelAction;
}

export interface GitLabMilestoneEvent {
  id: number;
  user: GitLabAuthor;
  created_at: string;
  milestone: GitLabMilestone | null;
  action: GitLabLabelAction;
}

export interface GitLabIterationEvent {
  id: number;
  user: GitLabAuthor;
  created_at: string;
  iteration: GitLabIteration | null;
  action: GitLabLabelAction;
}

export interface GitLabWeightEvent {
  id: number;
  user: GitLabAuthor;
  created_at: string;
  weight: number | null;
}

export interface GitLabStateEvent {
  id: number;
  user?: GitLabAuthor | null;
  created_at: string;
  state: GitLabState;
  source_merge_request_id?: number | null;
}
