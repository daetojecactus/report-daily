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

export enum GitLabIssuable {
  ISSUES = 'issues',
  MERGE_REQUESTS = 'merge_requests',
}
