import { GitLabTargetType } from 'src/modules/vendors/gitlab/gitlab.enums';
import type { SourceUserChange } from '../source.interface';

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

export const SOURCE_DRAFT_PATTERN =
  /^marked this merge request as \*\*(draft|ready)\*\*/;

export const SOURCE_READY_MARK = 'ready';
