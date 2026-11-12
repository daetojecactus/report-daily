export const GITLAB_SOURCE_BRANCH_ISSUE_PATTERN = /^(\d+)[-_]/;

export const GITLAB_SOURCE_COMMIT_MENTION_PATTERN =
  /^mentioned in commit (?:\S+@)?([0-9a-f]{7,40})/;

export const GITLAB_SOURCE_MAIN_BRANCHES = new Set(['main', 'master', 'develop']);

export const GITLAB_SOURCE_KEY_SEPARATOR = ':';

export const GITLAB_SOURCE_ITERATION_DATES_SEPARATOR = ' – ';

export const GITLAB_SOURCE_ISSUE_REFERENCE_PATTERN =
  /(?<![\w/.-])((?:[\w.-]+\/)*[\w.-]+)?#(\d+)\b/g;

export const GITLAB_SOURCE_PATH_SEPARATOR = '/';
