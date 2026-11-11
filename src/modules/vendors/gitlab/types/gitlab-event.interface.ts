import type { GitLabRefType } from './gitlab.enums';

export interface GitLabPushData {
  action: string;
  ref_type: GitLabRefType;
  ref: string | null;
  ref_count: number | null;
  commit_count: number;
  commit_from: string | null;
  commit_to: string | null;
  commit_title: string | null;
}

interface GitLabEventNote {
  body: string;
  noteable_type: string;
  noteable_iid: number | null;
}

export interface GitLabEvent {
  id: number;
  project_id: number | null;
  action_name: string;
  target_type: string | null;
  target_id?: number | null;
  target_iid: number | null;
  target_title: string | null;
  created_at: string;
  push_data?: GitLabPushData;
  note?: GitLabEventNote;
}
