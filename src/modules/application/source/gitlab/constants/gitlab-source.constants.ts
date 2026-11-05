import {
  GitLabLabelAction,
  GitLabState,
  GitLabTargetType,
} from 'src/modules/vendors/gitlab/gitlab.enums';
import { z } from 'zod';
import { ItemState, LabelAction, SourceActionKind } from '../../source.enums';
import type {
  SourceNoteAction,
  SourceUserChange,
} from '../gitlab-source.interface';

export const GITLAB_SOURCE_ISSUE_TARGET_TYPES = new Set<string>([
  GitLabTargetType.ISSUE,
  GitLabTargetType.WORK_ITEM,
]);

export const GITLAB_SOURCE_BRANCH_ISSUE_PATTERN = /^(\d+)-/;

export const GITLAB_SOURCE_MAIN_BRANCHES = new Set([
  'main',
  'master',
  'develop',
]);

export const GITLAB_SOURCE_KEY_SEPARATOR = ':';

export const GITLAB_SOURCE_ASSIGNEE_CHANGE: SourceUserChange = {
  added: 'assigned to ',
  removed: 'unassigned ',
};

export const GITLAB_SOURCE_REVIEWER_CHANGE: SourceUserChange = {
  added: 'requested review from ',
  removed: 'removed review request for ',
};

export const GITLAB_SOURCE_MENTION_PATTERN = /@([a-zA-Z0-9._-]+)/g;

export const GITLAB_SOURCE_NOTE_ACTIONS: SourceNoteAction[] = [
  {
    pattern: /^set status to \*\*(.+?)\*\*/,
    kind: SourceActionKind.STATUS_SET,
  },
  { pattern: /^approved this merge request/, kind: SourceActionKind.APPROVED },
  {
    pattern: /^unapproved this merge request/,
    kind: SourceActionKind.UNAPPROVED,
  },
  {
    pattern: /^marked this merge request as \*\*ready\*\*/,
    kind: SourceActionKind.MARKED_READY,
  },
  {
    pattern: /^marked this merge request as \*\*draft\*\*/,
    kind: SourceActionKind.MARKED_DRAFT,
  },
  {
    pattern: /^changed the description/,
    kind: SourceActionKind.DESCRIPTION_CHANGED,
  },
  {
    pattern: /^(?:<p>)?changed title from/,
    kind: SourceActionKind.TITLE_CHANGED,
  },
  { pattern: /^resolved all threads/, kind: SourceActionKind.THREADS_RESOLVED },
  {
    pattern: /^created branch \[`(.+?)`\]/,
    kind: SourceActionKind.BRANCH_CREATED,
  },
  {
    pattern: /^changed this line in/,
    kind: SourceActionKind.DIFF_LINE_CHANGED,
  },
  { pattern: /^left review comments/, kind: SourceActionKind.REVIEW_SUBMITTED },
];

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

export const GITLAB_SOURCE_LABEL_ACTIONS: Record<
  GitLabLabelAction,
  LabelAction
> = {
  [GitLabLabelAction.ADD]: LabelAction.ADD,
  [GitLabLabelAction.REMOVE]: LabelAction.REMOVE,
};

export const GITLAB_SOURCE_LOOKBACK_DAYS = 30;

export const GITLAB_SOURCE_INDEX_KEY = 'source:gitlab:day';

export const GITLAB_SOURCE_INDEX_TTL_MS = 900_000;

export const GITLAB_SOURCE_SCAN_LIMIT = 300;

export const GITLAB_SOURCE_INDEX_SCHEMA = z.record(
  z.string(),
  z.object({
    issues: z.array(z.number().int()),
    mergeRequests: z.array(z.number().int()),
  }),
);
