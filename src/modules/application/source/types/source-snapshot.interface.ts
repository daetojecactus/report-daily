import type { ItemState } from './source.enums';

export interface ItemSnapshot {
  state: ItemState;
  labels: string[];
  assignees: string[];
  status: string | null;
  milestone: string | null;
}

export interface IssueSnapshot extends ItemSnapshot {
  iteration: string | null;
  weight: number | null;
}

export interface MergeRequestSnapshot extends ItemSnapshot {
  reviewers: string[];
  draft: boolean;
}
