import {
  GitLabState,
  GitLabTargetType,
} from 'src/modules/vendors/gitlab/gitlab.enums';
import { SourceActionKind } from '../source.enums';
import type { SourceNoteAction, SourceUserChange } from '../source.interface';

export const SOURCE_ISSUE_TARGET_TYPES = new Set<string>([
  GitLabTargetType.ISSUE,
  GitLabTargetType.WORK_ITEM,
]);

export const SOURCE_BRANCH_ISSUE_PATTERN = /^(\d+)-/;

export const SOURCE_MAIN_BRANCHES = new Set(['main', 'master', 'develop']);

export const SOURCE_KEY_SEPARATOR = ':';

export const SOURCE_ASSIGNEE_CHANGE: SourceUserChange = {
  added: 'assigned to ',
  removed: 'unassigned ',
};

export const SOURCE_REVIEWER_CHANGE: SourceUserChange = {
  added: 'requested review from ',
  removed: 'removed review request for ',
};

export const SOURCE_MENTION_PATTERN = /@([a-zA-Z0-9._-]+)/g;

export const SOURCE_NOTE_ACTIONS: SourceNoteAction[] = [
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

export const SOURCE_DRAFT_ACTIONS = new Set([
  SourceActionKind.MARKED_READY,
  SourceActionKind.MARKED_DRAFT,
]);

export const SOURCE_STATE_ACTIONS = new Map([
  [GitLabState.CLOSED, SourceActionKind.CLOSED],
  [GitLabState.REOPENED, SourceActionKind.REOPENED],
  [GitLabState.MERGED, SourceActionKind.MERGED],
]);
