import { ActivityReason } from 'src/modules/application/report/activity/activity.enums';
import { SourceTargetType } from 'src/modules/application/source/source.enums';

export const PREVIEW_INDENT = '  ';

export const PREVIEW_TRACE_FLAG = '--trace';

export const PREVIEW_REASONS: Record<ActivityReason, string> = {
  [ActivityReason.ONLY]: 'the only action',
  [ActivityReason.TIER]: 'a higher tier',
  [ActivityReason.WEIGHT]: 'a higher weight',
  [ActivityReason.TIME]: 'a later time',
};

export const PREVIEW_URL = 'https://gitlab.example.com';

export const PREVIEW_GROUP = 'group';

export const PREVIEW_ISSUES_PATH = 'issues';

export const PREVIEW_MERGE_REQUESTS_PATH = 'merge_requests';

export const PREVIEW_USER_ALIAS = 'user';

export const PREVIEW_PROJECT_ALIAS = 'project';

export const PREVIEW_LABEL_ALIAS = 'label';

export const PREVIEW_STATUS_ALIAS = 'status';

export const PREVIEW_BRANCH_ALIAS = 'branch';

export const PREVIEW_TAG_ALIAS = 'tag';

export const PREVIEW_MINUTE_SECONDS = 60;

export const PREVIEW_HOUR_SECONDS = 60 * 60;

export const PREVIEW_MILESTONE_ALIAS = 'milestone';

export const PREVIEW_ITERATION_ALIAS = 'iteration';

export const PREVIEW_PAGE_ALIAS = 'page';

export const PREVIEW_TARGET_NAMES: Record<SourceTargetType, string> = {
  [SourceTargetType.WIKI_PAGE]: 'Wiki page',
  [SourceTargetType.MILESTONE]: 'Milestone',
};

export const PREVIEW_TAG_VERSION_PATTERN = /\d+(?:\.\d+)*/;

export const PREVIEW_COMMIT_ALIAS = 'sha';

export const PREVIEW_COMMIT_TITLE = 'commit';

export const PREVIEW_TEST_COMMIT_PREFIX = 'test: ';

export const PREVIEW_RU_TEST_COMMIT_PREFIX = 'тест: ';

export const PREVIEW_ISSUE_TITLE = 'Issue';

export const PREVIEW_MERGE_REQUEST_TITLE = 'Merge request';

export const PREVIEW_TARGET_TITLE = 'Title';

export const PREVIEW_COMMENT = 'comment';

export const PREVIEW_SYSTEM_NOTE = 'system note';

export const PREVIEW_ACTION_VALUE = 'value';

export const PREVIEW_TITLE_NOTE = 'changed title from **Title** to **Title**';

export const PREVIEW_FIXTURE_EXTENSION = '.json';

export const PREVIEW_KEPT_LABELS = new Set([
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

export const PREVIEW_KEPT_STATUSES = new Set([
  'To do',
  'In progress',
  'Done',
  "Won't do",
  'Duplicate',
]);

export const PREVIEW_BOT_BRANCH_PATTERN = /^(?:renovate|dependabot)[/-]/i;

export const PREVIEW_TEST_COMMIT_PATTERN =
  /(?<![\p{L}\p{N}_])(?:test|tests|testing|e2e|spec|specs|autotest|autotests|pom|fixture|fixtures|cypress|playwright|selenium)(?![\p{L}\p{N}_])/iu;

export const PREVIEW_RU_TEST_COMMIT_PATTERN =
  /(?<![\p{L}\p{N}_])(?:тест|тесты|автотест|автотесты)(?![\p{L}\p{N}_])/iu;

export const PREVIEW_STATUS_NOTE_PATTERN = /^set status to \*\*(.+?)\*\*/;

export const PREVIEW_BRANCH_NOTE_PATTERN = /^created branch \[`(.+?)`\]/;

export const PREVIEW_TITLE_NOTE_PATTERN = /^(?:<p>)?changed title from/;

export const PREVIEW_USER_NOTE_PREFIXES = [
  'assigned to ',
  'unassigned ',
  'requested review from ',
  'removed review request for ',
];

export const PREVIEW_NOTE_PREFIXES = [
  'approved this merge request',
  'unapproved this merge request',
  'marked this merge request as **ready**',
  'marked this merge request as **draft**',
  'changed the description',
  'resolved all threads',
  'changed this line in',
  'left review comments',
];
