export enum GitLabTargetType {
  ISSUE = 'Issue',
  WORK_ITEM = 'WorkItem',
  MERGE_REQUEST = 'MergeRequest',
}

export enum GitLabState {
  OPENED = 'opened',
  CLOSED = 'closed',
  MERGED = 'merged',
  LOCKED = 'locked',
  REOPENED = 'reopened',
}

export enum GitLabLabelAction {
  ADD = 'add',
  REMOVE = 'remove',
}

export enum GitLabRefType {
  BRANCH = 'branch',
  TAG = 'tag',
}

export enum GitLabIssuable {
  ISSUES = 'issues',
  MERGE_REQUESTS = 'merge_requests',
}
