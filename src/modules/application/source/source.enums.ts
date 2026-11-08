export enum Source {
  GITLAB = 'gitlab',
}

export enum ItemState {
  OPENED = 'opened',
  CLOSED = 'closed',
  MERGED = 'merged',
  LOCKED = 'locked',
}

export enum LabelAction {
  ADD = 'add',
  REMOVE = 'remove',
}

export enum SourceRefType {
  BRANCH = 'branch',
  TAG = 'tag',
}

export enum SourceEventAction {
  OPENED = 'opened',
  CREATED = 'created',
  CLOSED = 'closed',
  REOPENED = 'reopened',
  ACCEPTED = 'accepted',
  APPROVED = 'approved',
  PUSHED_TO = 'pushed to',
  PUSHED_NEW = 'pushed new',
  DELETED = 'deleted',
}

export enum SourceActionKind {
  OPENED = 'opened',
  PUSHED = 'pushed',
  COMMENTED = 'commented',
  CLOSED = 'closed',
  REOPENED = 'reopened',
  MERGED = 'merged',
  STATUS_SET = 'status_set',
  LABEL_ADDED = 'label_added',
  LABEL_REMOVED = 'label_removed',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  REVIEW_REQUESTED = 'review_requested',
  REVIEW_REQUEST_REMOVED = 'review_request_removed',
  APPROVED = 'approved',
  UNAPPROVED = 'unapproved',
  MARKED_READY = 'marked_ready',
  MARKED_DRAFT = 'marked_draft',
  DESCRIPTION_CHANGED = 'description_changed',
  TITLE_CHANGED = 'title_changed',
  THREADS_RESOLVED = 'threads_resolved',
  BRANCH_CREATED = 'branch_created',
  DIFF_LINE_CHANGED = 'diff_line_changed',
  REVIEW_SUBMITTED = 'review_submitted',
  MILESTONE_SET = 'milestone_set',
  MILESTONE_REMOVED = 'milestone_removed',
  ITERATION_SET = 'iteration_set',
  ITERATION_REMOVED = 'iteration_removed',
  WEIGHT_SET = 'weight_set',
  WEIGHT_REMOVED = 'weight_removed',
}
