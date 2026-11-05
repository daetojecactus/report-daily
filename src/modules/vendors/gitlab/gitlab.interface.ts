import type { GitLabLabelAction, GitLabState } from './gitlab.enums';

export type GitLabQuery = Record<string, string | number | boolean>;

export interface GitLabHttpResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  body: string;
}

export interface GitLabPage<T> {
  body: T;
  nextPage: number | null;
}

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url: string;
}

export interface GitLabAuthor {
  id: number;
  username: string;
  name: string;
}

export interface GitLabPushData {
  action: string;
  ref_type: string;
  ref: string | null;
  commit_count: number;
  commit_from: string | null;
  commit_to: string | null;
  commit_title: string | null;
}

export interface GitLabEventNote {
  body: string;
  noteable_type: string;
  noteable_iid: number | null;
}

export interface GitLabEvent {
  id: number;
  project_id: number | null;
  action_name: string;
  target_type: string | null;
  target_iid: number | null;
  target_title: string | null;
  created_at: string;
  push_data?: GitLabPushData;
  note?: GitLabEventNote;
}

export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  default_branch: string | null;
}

export interface GitLabIssuableItem {
  iid: number;
  project_id: number;
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
  draft?: boolean;
  author?: GitLabAuthor | null;
  assignees?: GitLabAuthor[];
  reviewers?: GitLabAuthor[];
}

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

export interface GitLabStateEvent {
  id: number;
  user?: GitLabAuthor | null;
  created_at: string;
  state: GitLabState;
}

export interface GitLabCommit {
  id: string;
  title: string;
  created_at: string;
  committed_date?: string;
}
