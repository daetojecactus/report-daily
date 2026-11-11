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
  committed_date?: string;
}
