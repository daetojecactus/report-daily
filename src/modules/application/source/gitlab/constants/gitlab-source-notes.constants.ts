import { SourceActionKind } from '../../types/source.enums';
import type { SourceNoteAction } from '../types/gitlab-source.interface';
import { GITLAB_SOURCE_COMMIT_MENTION_PATTERN } from './gitlab-source-keys.constants';

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
    pattern: /^changed this (?:line|file) in/,
    kind: SourceActionKind.DIFF_LINE_CHANGED,
  },
  { pattern: /^left review comments/, kind: SourceActionKind.REVIEW_SUBMITTED },
  { pattern: /^requested changes\b/, kind: SourceActionKind.CHANGES_REQUESTED },
  {
    pattern: /^(?:enabled an automatic merge|set to auto-merge)\b/,
    kind: SourceActionKind.AUTO_MERGE_SET,
  },
  {
    pattern: /^(?:canceled|cancelled) the automatic merge\b/,
    kind: SourceActionKind.AUTO_MERGE_CANCELED,
  },
  { pattern: GITLAB_SOURCE_COMMIT_MENTION_PATTERN, kind: SourceActionKind.COMMIT_MENTIONED },
  {
    pattern:
      /^marked (?:this (?:issue|item|work item|task|incident) )?as (related to|blocking|blocked by)\b/,
    kind: SourceActionKind.LINKED,
  },
  { pattern: /^added .+? as (parent)\b/, kind: SourceActionKind.LINKED },
  { pattern: /^added to (epic)\b/, kind: SourceActionKind.LINKED },
  { pattern: /^marked \S+ as a (duplicate) of this\b/, kind: SourceActionKind.LINKED },
  { pattern: /^added .+? as child\b/, kind: SourceActionKind.CHILD_ADDED },
  {
    pattern: /^(?:removed the relation with|removed (?:child|parent)\b|removed from epic)/,
    kind: SourceActionKind.UNLINKED,
  },
  { pattern: /^moved from (\S+)/, kind: SourceActionKind.MOVED_IN },
  { pattern: /^moved to (\S+)/, kind: SourceActionKind.MOVED_OUT },
  {
    pattern: /^marked this (?:issue|item|work item|task|incident) as a duplicate of\b/,
    kind: SourceActionKind.DUPLICATE_MARKED,
  },
];

export const GITLAB_SOURCE_KNOWN_NOTES = [
  /^added \d+ commits?\b/,
  /^mentioned in (?:merge request|issue|epic|work item)\b/,
  /^changed target branch from/,
  /^reset approvals from/,
  /^made the (?:issue|item|work item|merge request) (?:confidential|visible to everyone)/,
  /^(?:locked|unlocked) (?:the discussion in )?this (?:issue|item|work item|merge request)/,
  /^(?:changed|removed) health status/,
  /^(?:added|removed) \d+ contacts?\b/,
  /^created merge request [^\s]*![\d]+ to address this/,
  /^cloned (?:to|from)\b/,
  /^marked the (?:checklist|task) item\b/,
  /^(?:added|subtracted|deleted) .+ of (?:time spent|spent time)\b/,
  /^removed time spent\b/,
  /^(?:changed|removed) time estimate\b/,
  /^aborted the automatic merge\b/,
  /^deleted the .+ branch\. This merge request now targets\b/,
];

export const GITLAB_SOURCE_LINK_KINDS = new Set<SourceActionKind>([
  SourceActionKind.LINKED,
  SourceActionKind.UNLINKED,
  SourceActionKind.CHILD_ADDED,
  SourceActionKind.DUPLICATE_MARKED,
]);

export const GITLAB_SOURCE_LINK_WINDOW_MS = 2000;

export const GITLAB_SOURCE_DATE_NOTE_PATTERN = /^(?:changed|removed) (?:start|due) date\b/;

export const GITLAB_SOURCE_DATE_CHANGE_PATTERN =
  /(changed|removed) (start|due) date(?: to)?(?: ([A-Z][a-z]+) (\d{1,2}), (\d{4}))?/g;

export const GITLAB_SOURCE_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const GITLAB_SOURCE_DATE_ACTIONS = new Map<string, SourceActionKind>([
  ['changed due', SourceActionKind.DUE_DATE_SET],
  ['removed due', SourceActionKind.DUE_DATE_REMOVED],
  ['changed start', SourceActionKind.START_DATE_SET],
  ['removed start', SourceActionKind.START_DATE_REMOVED],
]);

export const GITLAB_SOURCE_TIME_SPENT_PATTERN =
  /^(added|subtracted|deleted) ((?:\d+(?:mo|w|d|h|m|s) ?)+) of (?:time spent|spent time)(?: (?:at|from) (\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}:\d{2}))?(?: ([+-]\d{2})(\d{2}))?)?/;

export const GITLAB_SOURCE_TIME_UNIT_PATTERN = /(\d+)(mo|w|d|h|m|s)/g;

export const GITLAB_SOURCE_TIME_UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 8 * 60 * 60,
  w: 5 * 8 * 60 * 60,
  mo: 4 * 5 * 8 * 60 * 60,
};

export const GITLAB_SOURCE_NOTE_SHAPE_WORDS = 6;

export const GITLAB_SOURCE_NOTE_SHAPE_REPLACEMENTS: [RegExp, string][] = [
  [/<[^>]+>/g, ' '],
  [/https?:\/\/\S+/g, 'URL'],
  [/@[\w.-]+/g, '@user'],
  [/\*\*[^*]*\*\*/g, '**x**'],
  [/`[^`]*`/g, '`x`'],
  [/\[[^\]]*\]\([^)]*\)/g, '[link]'],
  [/~"[^"]*"|~[\w:.-]+/g, '~label'],
  [/%"[^"]*"|%[\w.-]+/g, '%milestone'],
  [/[\w.-]+(?:\/[\w.-]+)+[#!&]\d+/g, 'REF'],
  [/[#!&]\d+/g, 'REF'],
  [/\b[0-9a-f]{7,40}\b/g, 'SHA'],
  [/\d+/g, 'N'],
  [/[^\x20-\x7E]+/g, 'X'],
  [/\s+/g, ' '],
];
