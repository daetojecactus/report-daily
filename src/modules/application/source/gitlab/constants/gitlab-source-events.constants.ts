import {
  GitLabLabelAction,
  GitLabRefType,
  GitLabState,
  GitLabTargetType,
} from 'src/modules/vendors/gitlab/types/gitlab.enums';
import {
  ItemState,
  LabelAction,
  SourceActionKind,
  SourceRefType,
  SourceTargetType,
  WorkItemType,
} from '../../types/source.enums';
import type { SourceUserChange } from '../types/gitlab-source.interface';

export const GITLAB_SOURCE_ISSUE_TARGET_TYPES = new Set<string>([
  GitLabTargetType.ISSUE,
  GitLabTargetType.WORK_ITEM,
]);

export const GITLAB_SOURCE_PROJECT_TARGET_TYPES = new Map<string, SourceTargetType>([
  [GitLabTargetType.WIKI_PAGE, SourceTargetType.WIKI_PAGE],
  [GitLabTargetType.MILESTONE, SourceTargetType.MILESTONE],
]);

export const GITLAB_SOURCE_WORK_ITEM_TYPES = new Map<string, WorkItemType>(
  Object.values(WorkItemType).map((type) => [type, type]),
);

export const GITLAB_SOURCE_KNOWN_EVENTS = new Set(['joined', 'left', 'expired']);

export const GITLAB_SOURCE_REF_TYPES: Record<GitLabRefType, SourceRefType> = {
  [GitLabRefType.BRANCH]: SourceRefType.BRANCH,
  [GitLabRefType.TAG]: SourceRefType.TAG,
};

export const GITLAB_SOURCE_ASSIGNEE_CHANGE: SourceUserChange = {
  added: 'assigned to ',
  removed: 'unassigned ',
};

export const GITLAB_SOURCE_REVIEWER_CHANGE: SourceUserChange = {
  added: 'requested review from ',
  removed: 'removed review request for ',
};

export const GITLAB_SOURCE_DRAFT_ACTIONS = new Set([
  SourceActionKind.MARKED_READY,
  SourceActionKind.MARKED_DRAFT,
]);

export const GITLAB_SOURCE_STATE_ACTIONS = new Map([
  [GitLabState.CLOSED, SourceActionKind.CLOSED],
  [GitLabState.REOPENED, SourceActionKind.REOPENED],
  [GitLabState.MERGED, SourceActionKind.MERGED],
]);

export const GITLAB_SOURCE_ITEM_STATES: Record<GitLabState, ItemState> = {
  [GitLabState.OPENED]: ItemState.OPENED,
  [GitLabState.CLOSED]: ItemState.CLOSED,
  [GitLabState.MERGED]: ItemState.MERGED,
  [GitLabState.LOCKED]: ItemState.LOCKED,
  [GitLabState.REOPENED]: ItemState.OPENED,
};

export const GITLAB_SOURCE_LABEL_ACTIONS: Record<GitLabLabelAction, LabelAction> = {
  [GitLabLabelAction.ADD]: LabelAction.ADD,
  [GitLabLabelAction.REMOVE]: LabelAction.REMOVE,
};

export const GITLAB_SOURCE_MILESTONE_ACTIONS: Record<GitLabLabelAction, SourceActionKind> = {
  [GitLabLabelAction.ADD]: SourceActionKind.MILESTONE_SET,
  [GitLabLabelAction.REMOVE]: SourceActionKind.MILESTONE_REMOVED,
};

export const GITLAB_SOURCE_ITERATION_ACTIONS: Record<GitLabLabelAction, SourceActionKind> = {
  [GitLabLabelAction.ADD]: SourceActionKind.ITERATION_SET,
  [GitLabLabelAction.REMOVE]: SourceActionKind.ITERATION_REMOVED,
};
