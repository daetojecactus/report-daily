import type { GitLabState } from './gitlab.enums';
import type { GitLabAuthor } from './gitlab.interface';

export interface GitLabIssuableItem {
  iid: number;
  project_id: number;
}

export interface GitLabMilestone {
  id: number;
  title: string;
}

export interface GitLabIteration {
  id: number;
  sequence: number;
  title: string | null;
  start_date: string;
  due_date: string;
}

export interface GitLabIssue {
  iid: number;
  project_id: number;
  title: string;
  state: GitLabState;
  labels: string[];
  web_url: string;
  created_at: string;
  author?: GitLabAuthor | null;
  assignees?: GitLabAuthor[];
  milestone?: GitLabMilestone | null;
  iteration?: GitLabIteration | null;
  weight?: number | null;
  issue_type?: string;
}

export interface GitLabMergeRequest {
  iid: number;
  project_id: number;
  title: string;
  state: GitLabState;
  labels: string[];
  web_url: string;
  created_at: string;
  source_branch: string;
  target_branch: string;
  sha: string | null;
  merge_commit_sha: string | null;
  squash_commit_sha: string | null;
  draft?: boolean;
  author?: GitLabAuthor | null;
  assignees?: GitLabAuthor[];
  reviewers?: GitLabAuthor[];
  milestone?: GitLabMilestone | null;
}
