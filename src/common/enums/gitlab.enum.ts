export enum GitLabTargetType {
  MERGE_REQUEST = 'MergeRequest',
  ISSUE = 'Issue',
  NOTE = 'Note',
  DIFF_NOTE = 'DiffNote',
  WORK_ITEM = 'WorkItem',
}

export enum GitLabNoteableType {
  MERGE_REQUEST = 'MergeRequest',
  ISSUE = 'Issue',
  COMMIT = 'Commit',
  SNIPPET = 'Snippet',
  WORK_ITEM = 'WorkItem',
}

export enum GitLabAction {
  PUSHED = 'pushed',
  PUSHED_TO = 'pushed to',
  PUSHED_NEW = 'pushed new',
  CREATED = 'created',
  OPENED = 'opened',
  CLOSED = 'closed',
  MERGED = 'merged',
  APPROVED = 'approved',
  ACCEPTED = 'accepted',
  COMMENTED_ON = 'commented on',
  DELETED = 'deleted',
  REOPENED = 'reopened',
}

export enum GitLabIssueState {
  OPENED = 'opened',
  CLOSED = 'closed',
}

export enum GitLabMergeRequestState {
  OPENED = 'opened',
  CLOSED = 'closed',
  MERGED = 'merged',
  LOCKED = 'locked',
}

export enum MainBranch {
  MAIN = 'main',
  MASTER = 'master',
  DEVELOP = 'develop',
}

export enum ParsedEventType {
  ISSUE = 'issue',
  MERGE_REQUEST = 'merge_request',
  PUSH = 'push',
  UNKNOWN = 'unknown',
}
