export type GitLabQuery = Record<string, string | number | boolean | string[]>;

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

export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  default_branch: string | null;
}

export interface GitLabCommit {
  id: string;
  title: string;
  created_at: string;
  authored_date?: string;
  committed_date?: string;
  committer_email?: string;
  parent_ids?: string[];
}

export interface GitLabPushCommits {
  commits: GitLabCommit[];
  rewritten: boolean;
}

interface GitLabDescriptionNote {
  systemNoteMetadata: { descriptionVersion: { diff: string | null } | null } | null;
}

export interface GitLabDescriptionQuery {
  data?: Record<string, GitLabDescriptionNote | null> | null;
  errors?: { message: string }[];
}
