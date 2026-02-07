export enum GitLabTargetType {
  MERGE_REQUEST = 'MergeRequest',
  ISSUE = 'Issue',
  WORK_ITEM = 'WorkItem',
}

export enum GitLabAction {
  PUSHED_TO = 'pushed to',
  PUSHED_NEW = 'pushed new',
  OPENED = 'opened',
  CLOSED = 'closed',
  MERGED = 'merged',
  APPROVED = 'approved',
  ACCEPTED = 'accepted',
  COMMENTED_ON = 'commented on',
  DELETED = 'deleted',
}

export enum GitLabIssueState {
  OPENED = 'OPENED',
  CLOSED = 'CLOSED',
}

export enum MainBranch {
  MAIN = 'main',
  MASTER = 'master',
  DEVELOP = 'develop',
}
