export interface GitLabAuthor {
  id: number;
  username: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url: string;
}

export interface GitLabEvent {
  id: number;
  project_id: number;
  action_name: string;
  target_id: number;
  target_iid: number;
  target_type: string;
  target_title: string;
  created_at: string;
  author_id: number;
  author_username: string;
  push_data?: GitLabPushData;
  note?: GitLabNote;
  author?: GitLabAuthor;
}

export interface GitLabPushData {
  commit_count: number;
  action: "pushed" | "created" | "removed";
  ref_type: "branch" | "tag";
  commit_from: string | null;
  commit_to: string | null;
  ref: string;
  commit_title: string | null;
  ref_count: number | null;
}

export interface GitLabNote {
  id: number;
  type: string | null;
  body: string;
  noteable_id: number;
  noteable_type: "MergeRequest" | "Issue" | "WorkItem" | "Commit";
  noteable_iid: number;
  project_id: number;
  created_at: string;
  updated_at: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path: string;
  path_with_namespace: string;
  web_url: string;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  state: "opened" | "closed";
  project_id: number;
  labels: string[];
  created_at: string;
  issue_type?: "issue" | "incident" | "test_case" | "task";
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  state: string;
  source_branch: string;
  target_branch: string;
  project_id: number;
  author?: GitLabAuthor | null;
  assignee?: GitLabAuthor | null;
  assignees?: GitLabAuthor[];
  reviewers?: GitLabAuthor[];
  labels?: string[];
  created_at: string;
  user_notes_count?: number;
}

export interface GitLabMRNote {
  id: number;
  body: string;
  author: GitLabAuthor;
  created_at: string;
  updated_at: string;
  system: boolean;
  resolvable: boolean;
  resolved?: boolean;
  resolved_by?: GitLabAuthor | null;
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  created_at: string;
}
