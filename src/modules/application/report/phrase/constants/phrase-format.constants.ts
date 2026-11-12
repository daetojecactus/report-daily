export const PHRASE_DATE_RANGE_PATTERN = /(\d{4}-\d{2}-\d{2}) – (\d{4}-\d{2}-\d{2})/g;

export const PHRASE_DATE_PATTERN = /\d{4}-\d{2}-\d{2}/g;

export const PHRASE_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
};

export const PHRASE_DATE_TIME_SUFFIX = 'T00:00:00Z';

export const PHRASE_REFERENCE_SUFFIX_PATTERN = /#\d+$/;

export const PHRASE_REFERENCE_SEPARATOR = ', ';

export const PHRASE_ISSUE_PREFIX = '#';

export const PHRASE_MERGE_REQUEST_PREFIX = '!';

export const PHRASE_DRAFT_TITLE_PATTERN = /^(?:(?:draft|wip):\s*|[[(](?:draft|wip)[\])]\s*)+/i;

export const PHRASE_RESOLVE_TITLE_PATTERN = /^Resolve "(.+)"$/;

export const PHRASE_TITLE_SPACES_PATTERN = /\s+/g;
