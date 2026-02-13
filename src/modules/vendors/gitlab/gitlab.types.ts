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
  action_name:
    | 'pushed'
    | 'pushed to'
    | 'pushed new'
    | 'created'
    | 'opened'
    | 'closed'
    | 'merged'
    | 'approved'
    | 'accepted'
    | 'commented on'
    | 'deleted'
    | 'joined'
    | 'left'
    | 'expired';
  target_id: number | null;
  target_iid: number | null;
  target_type:
    | 'DiffNote'
    | 'Note'
    | 'MergeRequest'
    | 'Issue'
    | 'Snippet'
    | null;
  target_title: string | null;
  created_at: string;
  author_id: number;
  author_username: string;
  push_data?: GitLabPushData;
  note?: GitLabNote;
  author?: GitLabAuthor;
}

export interface GitLabPushData {
  commit_count: number;
  action: 'pushed' | 'created' | 'removed';
  ref_type: 'branch' | 'tag';
  commit_from: string | null;
  commit_to: string | null;
  ref: string;
  commit_title: string | null;
  ref_count: number | null;
}

export interface GitLabNote {
  id: number;
  type: 'Note' | 'DiffNote' | 'DiscussionNote' | null;
  body: string;
  attachment?: any;
  author: GitLabAuthor;
  created_at: string;
  updated_at: string;
  system: boolean;
  noteable_id: number;
  noteable_type: 'MergeRequest' | 'Issue' | 'WorkItem' | 'Commit' | 'Snippet';
  noteable_iid: number;
  project_id: number;
  resolvable: boolean;
  resolved?: boolean;
}

export interface GitLabLabelEvent {
  id: number;
  user: GitLabAuthor;
  created_at: string;
  resource_type: 'Issue' | 'MergeRequest';
  resource_id: number;
  label: {
    id: number;
    name: string;
    color: string;
    description: string;
  };
  action: 'add' | 'remove';
}

export interface GitLabStateEvent {
  id: number;
  user: GitLabAuthor;
  created_at: string;
  resource_type: 'Issue' | 'MergeRequest';
  resource_id: number;
  state: 'opened' | 'closed' | 'merged' | 'reopened';
}

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path: string;
  path_with_namespace: string;
  web_url: string;
  description?: string;
  star_count: number;
  forks_count: number;
  last_activity_at: string;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  description: string;
  state: 'opened' | 'closed';
  project_id: number;
  labels: string[];
  author: GitLabAuthor;
  assignee?: GitLabAuthor | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  issue_type?: 'issue' | 'incident' | 'test_case' | 'task';
  web_url: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string;
  state: 'opened' | 'closed' | 'locked' | 'merged';
  source_branch: string;
  target_branch: string;
  project_id: number;
  author: GitLabAuthor;
  assignee?: GitLabAuthor | null;
  assignees?: GitLabAuthor[];
  reviewers?: GitLabAuthor[];
  labels: string[];
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
  closed_at?: string | null;
  user_notes_count: number;
  web_url: string;
  has_conflicts: boolean;
  blocking_discussions_resolved: boolean;
  pipeline?: GitLabPipeline; // Короткая инфа о пайплайне
}

export interface GitLabPipeline {
  id: number;
  project_id: number;
  status:
    | 'running'
    | 'pending'
    | 'success'
    | 'failed'
    | 'canceled'
    | 'skipped'
    | 'manual';
  ref: string;
  sha: string;
  web_url: string;
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
  committer_name?: string;
  committer_email?: string;
  committed_date?: string;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export interface GitLabMRApprovals {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  approvals_required: number;
  approvals_left: number;
  approved_by: Array<{ user: GitLabAuthor }>;
}

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url: string;
}
