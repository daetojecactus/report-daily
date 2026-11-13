import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toSourceKey } from 'src/common/utils/source-name.util';
import type { JobRole } from 'src/modules/application/user/types/user.enums';

const DIRECTORY = join(process.cwd(), 'test', 'fixtures', 'golden');

const COMMENT = 'comment';
const SYSTEM_NOTE = 'system note';
const TITLE_NOTE = 'changed title from **Title** to **Title**';
const KEPT_LABELS = new Set([
  'status::todo',
  'status::sprint backlog',
  'status::doing',
  'status::review',
  'status::after review',
  'status::ready for qa',
  'status::testing',
  'status::qa in progress',
  'status::qa passed',
  'status::need information',
  'status::hold',
  'status::frontend',
  'type::bug',
  'type::feature',
  'type::hotfix',
  'type::maintenance',
  'type::epic',
  'type::qa',
  'type::e2e',
  'type::ignore',
  'priority::critical',
  'priority::high',
  'priority::medium',
  'priority::low',
  'qa::returned to development',
  'test::e2e required',
  'test::unit',
  'needs-rebase',
  'bug',
  'feature',
  'hotfix',
  'maintenance',
  'epic',
]);
const KEPT_STATUSES = new Set(['To do', 'In progress', 'Done', "Won't do", 'Duplicate']);
const NOTE_PREFIXES = [
  'approved this merge request',
  'unapproved this merge request',
  'marked this merge request as **ready**',
  'marked this merge request as **draft**',
  'changed the description',
  'resolved all threads',
  'changed this line in',
  'left review comments',
];

const USER = /^user-\d+$/;
const CONVENTIONAL = '(?:(?:feat|fix|docs|test|refactor)(?:\\(deps\\))?: |chore\\(deps\\): )?';
const TITLE = new RegExp(
  `^(?:Issue \\d+|${CONVENTIONAL}Merge request \\d+|${CONVENTIONAL}commit \\d+(?: \\((?:test|тест)\\))?|page-\\d+|milestone-\\d+)$`,
);
const COMMIT_TITLE = new RegExp(`^${CONVENTIONAL}commit \\d+(?: \\((?:test|тест)\\))?$`);
const BRANCH = /^(?:main|master|develop|(?:\d+-|renovate[/-]|dependabot[/-])?branch-\d+)$/i;
const TAG = /^(?:v\d+(?:\.\d+)*|tag-\d+)$/;
const PLAN = /^(?:milestone|iteration)-\d+$/;
const URL =
  /^https:\/\/gitlab\.example\.com\/group\/project-\d+(?:\/-\/(?:issues|merge_requests)\/\d+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/;
const WORDS = /^[A-Za-z_ ]+$/;
const USER_NOTE =
  /^(?:assigned to |unassigned |requested review from |removed review request for )/;
const USER_NOTE_WORDS =
  /@user-\d+|assigned to|unassigned|requested review from|removed review request for|and|,/g;

function isLabel(value: string) {
  return KEPT_LABELS.has(toSourceKey(value)) || /^label-\d+$/.test(value);
}

function isStatus(value: string) {
  return KEPT_STATUSES.has(value) || /^status-\d+$/.test(value);
}

function isNoteBody(value: string) {
  if (value === COMMENT || value === SYSTEM_NOTE || value === TITLE_NOTE) {
    return true;
  }
  const status = /^set status to \*\*(.+)\*\*$/.exec(value);
  const branch = /^created branch \[`(.+)`\]\(https:\/\/gitlab\.example\.com\)$/.exec(value);
  return (
    NOTE_PREFIXES.includes(value) ||
    (status !== null && isStatus(status[1])) ||
    (branch !== null && BRANCH.test(branch[1])) ||
    /^mentioned in commit sha-\d+$/.test(value) ||
    (USER_NOTE.test(value) && value.replaceAll(USER_NOTE_WORDS, '').trim() === '')
  );
}

const CHECKS: Record<string, (value: string) => boolean> = {
  username: (value) => USER.test(value),
  actor: (value) => USER.test(value),
  authorUsername: (value) => USER.test(value),
  authorName: (value) => USER.test(value),
  author: (value) => USER.test(value),
  assignees: (value) => USER.test(value),
  reviewers: (value) => USER.test(value),
  users: (value) => USER.test(value),
  title: (value) => TITLE.test(value),
  targetTitle: (value) => value === 'Title',
  commitTitle: (value) => COMMIT_TITLE.test(value),
  webUrl: (value) => URL.test(value),
  name: (value) => /^project-\d+$/.test(value),
  path: (value) => /^group\/project-\d+$/.test(value),
  branch: (value) => BRANCH.test(value),
  sourceBranch: (value) => BRANCH.test(value),
  ref: (value) => BRANCH.test(value) || TAG.test(value),
  id: (value) => /^sha-\d+$/.test(value),
  labels: isLabel,
  labelName: isLabel,
  status: isStatus,
  value: (value) =>
    isLabel(value) ||
    isStatus(value) ||
    BRANCH.test(value) ||
    PLAN.test(value) ||
    /^\d+$/.test(value) ||
    /^sha-\d+$/.test(value) ||
    /^(?:related to|blocking|blocked by|parent|epic|duplicate)$/.test(value) ||
    /^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(value) ||
    value === 'value',
  milestone: (value) => PLAN.test(value),
  iteration: (value) => PLAN.test(value),
  body: isNoteBody,
  noteBody: (value) => value === COMMENT,
  createdAt: (value) => DATE.test(value),
  lastCommitAt: (value) => DATE.test(value),
  at: (value) => DATE.test(value),
  date: (value) => DATE.test(value),
  timeZone: (value) => /^[A-Za-z]+\/[A-Za-z_]+$/.test(value),
  role: (value) => WORDS.test(value),
  state: (value) => WORDS.test(value),
  kind: (value) => WORDS.test(value),
  action: (value) => WORDS.test(value),
  actionName: (value) => WORDS.test(value),
  targetType: (value) => WORDS.test(value),
  refType: (value) => WORDS.test(value),
  noteableType: (value) => WORDS.test(value),
};

function findLeaks(value: unknown, key: string, path: string): string[] {
  if (typeof value === 'string') {
    const check = CHECKS[key] as ((text: string) => boolean) | undefined;
    return check?.(value) ? [] : [`${path}: ${value}`];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findLeaks(item, key, `${path}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([name, item]) =>
      findLeaks(item, name, `${path}.${name}`),
    );
  }
  return [];
}

interface FixtureFile {
  role: JobRole;
  day: ItemKeys;
}

interface PushKey {
  projectId: number;
  branch?: string;
  ref?: string | null;
}

interface ItemKeys {
  issues: { projectId: number; iid: number; pushes?: PushKey[] }[];
  standaloneMergeRequests: { projectId: number; iid: number }[];
  standalonePushes: PushKey[];
}

function toKeys(day: ItemKeys) {
  return {
    issues: day.issues.map(({ projectId, iid }) => `${projectId}#${iid}`),
    standaloneMergeRequests: day.standaloneMergeRequests.map(
      ({ projectId, iid }) => `${projectId}!${iid}`,
    ),
    standalonePushes: [...day.standalonePushes, ...day.issues.flatMap(({ pushes }) => pushes ?? [])]
      .map(({ projectId, branch, ref }) => `${projectId}:${branch ?? ref}`)
      .toSorted(),
  };
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(DIRECTORY, name), 'utf8')) as T;
}

const names = readdirSync(DIRECTORY).filter(
  (name) => name.endsWith('.json') && !name.endsWith('.v1.json'),
);

describe('golden fixtures', () => {
  it('exist for several roles', () => {
    const roles = new Set(names.map((name) => readJson<FixtureFile>(name).role));

    expect(roles.size).toBeGreaterThanOrEqual(3);
  });

  it.each(names)('%s holds only anonymized values', (name) => {
    expect(findLeaks(readJson<unknown>(name), '', name)).toEqual([]);
  });

  it.each(names)('%s has a V1 verdict for every item', (name) => {
    const fixture = readJson<FixtureFile>(name);
    const verdicts = readJson<ItemKeys>(name.replace(/\.json$/, '.v1.json'));

    expect(toKeys(verdicts)).toEqual(toKeys(fixture.day));
  });
});
