import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toSourceKey } from 'src/common/utils/source-name.util';
import type { GroupedDailyData } from 'src/modules/application/source/source.interface';
import {
  Priority,
  TaskFlag,
  TaskKind,
  TraitDimension,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import type { TraitIndex, TraitValue } from 'src/modules/application/trait/trait.interface';
import type { JobRole } from 'src/modules/application/user/user.enums';
import { ActivityAction } from '../activity.enums';
import type { ActivityCandidate, ActivityResult } from '../activity.interface';
import { createService } from './activity.fixture';

export interface GoldenVerdict {
  projectId: number;
  iid?: number;
  branch?: string;
  status: string;
}

export interface GoldenDay {
  name: string;
  role: JobRole;
  username: string;
  day: GroupedDailyData;
  verdicts: {
    issues: GoldenVerdict[];
    standaloneMergeRequests: GoldenVerdict[];
    standalonePushes: GoldenVerdict[];
  };
}

const DIRECTORY = join(process.cwd(), 'test', 'fixtures', 'golden');

const MAPPINGS: [string, TraitDimension, TraitValue][] = [
  ['status::todo', TraitDimension.WORKFLOW_STATE, WorkflowState.PLANNED],
  ['status::sprint backlog', TraitDimension.WORKFLOW_STATE, WorkflowState.PLANNED],
  ['status::doing', TraitDimension.WORKFLOW_STATE, WorkflowState.IN_PROGRESS],
  ['status::review', TraitDimension.WORKFLOW_STATE, WorkflowState.REVIEW],
  ['status::after review', TraitDimension.WORKFLOW_STATE, WorkflowState.CHANGES_REQUESTED],
  ['status::ready for qa', TraitDimension.WORKFLOW_STATE, WorkflowState.READY_FOR_QA],
  ['status::testing', TraitDimension.WORKFLOW_STATE, WorkflowState.TESTING],
  ['status::qa in progress', TraitDimension.WORKFLOW_STATE, WorkflowState.TESTING],
  ['status::qa passed', TraitDimension.WORKFLOW_STATE, WorkflowState.QA_PASSED],
  ['status::need information', TraitDimension.WORKFLOW_STATE, WorkflowState.NEEDS_INFO],
  ['status::hold', TraitDimension.WORKFLOW_STATE, WorkflowState.BLOCKED],
  ['status::frontend', TraitDimension.WORKFLOW_STATE, WorkflowState.HANDOFF],
  ['type::bug', TraitDimension.TASK_KIND, TaskKind.BUG],
  ['bug', TraitDimension.TASK_KIND, TaskKind.BUG],
  ['type::feature', TraitDimension.TASK_KIND, TaskKind.FEATURE],
  ['feature', TraitDimension.TASK_KIND, TaskKind.FEATURE],
  ['type::hotfix', TraitDimension.TASK_KIND, TaskKind.HOTFIX],
  ['hotfix', TraitDimension.TASK_KIND, TaskKind.HOTFIX],
  ['type::maintenance', TraitDimension.TASK_KIND, TaskKind.MAINTENANCE],
  ['maintenance', TraitDimension.TASK_KIND, TaskKind.MAINTENANCE],
  ['type::epic', TraitDimension.TASK_KIND, TaskKind.EPIC],
  ['epic', TraitDimension.TASK_KIND, TaskKind.EPIC],
  ['type::qa', TraitDimension.TASK_KIND, TaskKind.QA_INTERNAL],
  ['type::e2e', TraitDimension.TASK_KIND, TaskKind.TEST_AUTOMATION],
  ['type::ignore', TraitDimension.FLAG, TaskFlag.EXCLUDE_FROM_REPORT],
  ['priority::critical', TraitDimension.PRIORITY, Priority.CRITICAL],
  ['priority::high', TraitDimension.PRIORITY, Priority.HIGH],
  ['priority::medium', TraitDimension.PRIORITY, Priority.MEDIUM],
  ['priority::low', TraitDimension.PRIORITY, Priority.LOW],
  ['qa::returned to development', TraitDimension.FLAG, TaskFlag.RETURNED_FROM_QA],
  ['test::e2e required', TraitDimension.FLAG, TaskFlag.E2E_REQUIRED],
  ['test::unit', TraitDimension.FLAG, TaskFlag.UNIT_TESTS_REQUIRED],
  ['needs-rebase', TraitDimension.FLAG, TaskFlag.NEEDS_REBASE],
  ['To do', TraitDimension.WORKFLOW_STATE, WorkflowState.PLANNED],
  ['In progress', TraitDimension.WORKFLOW_STATE, WorkflowState.IN_PROGRESS],
  ['Done', TraitDimension.WORKFLOW_STATE, WorkflowState.DONE],
];

export function createGoldenIndex(): TraitIndex {
  const pairs: TraitIndex['pairs'] = new Map();
  for (const [name, dimension, value] of MAPPINGS) {
    pairs.set(toSourceKey(name), [...(pairs.get(toSourceKey(name)) ?? []), { dimension, value }]);
  }
  return { pairs, ignored: new Set() };
}

export function loadGoldenDays(): GoldenDay[] {
  return readdirSync(DIRECTORY)
    .filter((file) => file.endsWith('.json') && !file.endsWith('.v1.json'))
    .toSorted()
    .map((file) => {
      const name = file.slice(0, -'.json'.length);
      const fixture = JSON.parse(readFileSync(join(DIRECTORY, file), 'utf8')) as Omit<
        GoldenDay,
        'name' | 'verdicts'
      >;
      const verdicts = JSON.parse(
        readFileSync(join(DIRECTORY, `${name}.v1.json`), 'utf8'),
      ) as GoldenDay['verdicts'];
      return { name, role: fixture.role, username: fixture.username, day: fixture.day, verdicts };
    });
}

export type GoldenReason = 'closed_by_others' | 'new_signal' | 'merge_request_labels' | 'composite';

export const GOLDEN_ACCEPTED: Record<string, [ActivityAction, WorkflowState?][]> = {
  FIXED_BUG: [[ActivityAction.MERGED]],
  IMPLEMENTED_FEATURE: [[ActivityAction.MERGED]],
  HOTFIX_DEPLOYED: [[ActivityAction.MERGED]],
  COMPLETED_BY_MERGE: [[ActivityAction.MERGED], [ActivityAction.COMPLETED]],
  MERGED_OTHERS_WORK: [[ActivityAction.MERGED_OTHER]],
  APPROVED_MR: [[ActivityAction.APPROVED]],
  TESTED_AND_APPROVED: [
    [ActivityAction.APPROVED],
    [ActivityAction.STATE_SET, WorkflowState.QA_PASSED],
  ],
  TESTED_WITH_COMMENTS: [[ActivityAction.REVIEWED], [ActivityAction.RETURNED]],
  REVIEW_COMMENT: [[ActivityAction.REVIEWED]],
  COMMENTED: [[ActivityAction.COMMENTED], [ActivityAction.DISCUSSED], [ActivityAction.REVIEWED]],
  PUT_ON_HOLD: [[ActivityAction.STATE_SET, WorkflowState.BLOCKED]],
  TASK_SENT_TO_QA: [[ActivityAction.STATE_SET, WorkflowState.READY_FOR_QA]],
  CLOSED_WITHOUT_MERGE: [[ActivityAction.CLOSED]],
  VERIFIED_FIX: [[ActivityAction.CLOSED]],
  ACCEPTED_WORK: [[ActivityAction.CLOSED]],
  REVIEWED_AND_CLOSED: [[ActivityAction.CLOSED]],
  STARTED: [[ActivityAction.CODE]],
  STARTED_IMPLEMENTATION: [[ActivityAction.CODE]],
  WROTE_CODE: [[ActivityAction.CODE]],
  REFACTORED_CODE: [[ActivityAction.CODE]],
  QA_AUTOMATION_DEVELOPED: [[ActivityAction.CODE], [ActivityAction.MERGED]],
  QA_AWAITING_TESTING: [[ActivityAction.STATE_ONLY], [ActivityAction.TOOK_REVIEW]],
  QA_IN_PROGRESS: [[ActivityAction.TOOK_REVIEW], [ActivityAction.STATE_SET, WorkflowState.TESTING]],
  FOUND_BUG: [[ActivityAction.BUG_FOUND]],
  REPORTED_BUG: [[ActivityAction.BUG_FOUND]],
  CREATED: [[ActivityAction.CREATED]],
  PLANNED_FEATURE: [[ActivityAction.CREATED]],
  DELEGATED_TASK: [
    [ActivityAction.COMMENTED],
    [ActivityAction.ASSIGNED],
    [ActivityAction.REQUIREMENTS, WorkflowState.IN_PROGRESS],
  ],
  UNKNOWN: [[ActivityAction.STATE_ONLY]],
  PROVIDED_REQUIREMENTS: [[ActivityAction.REQUIREMENTS], [ActivityAction.COMMENTED]],
  PLANNED_FOR_SPRINT: [
    [ActivityAction.STATE_SET, WorkflowState.PLANNED],
    [ActivityAction.REQUIREMENTS, WorkflowState.PLANNED],
  ],
};

export const GOLDEN_DIVERGENCES: Record<string, GoldenReason> = {
  'qa-user-1-2026-10-29 1#772': 'composite',
  'qa-user-1-2026-10-29 5#1061': 'closed_by_others',
  'qa-user-1-2026-10-30 1#748': 'merge_request_labels',
  'qa-user-1-2026-11-02 15!626': 'merge_request_labels',
  'qa-user-1-2026-11-03 1#759': 'merge_request_labels',
  'qa-user-1-2026-11-03 1#777': 'closed_by_others',
  'qa-user-1-2026-11-03 13#84': 'closed_by_others',
  'qa-user-1-2026-11-03 17#251': 'closed_by_others',
  'qa-user-1-2026-11-03 18#233': 'closed_by_others',
  'qa-user-1-2026-11-04 1#759': 'merge_request_labels',
  'qa-user-1-2026-11-04 3#1611': 'closed_by_others',
  'qa-user-1-2026-11-04 5#1064': 'closed_by_others',
  'qa-user-1-2026-11-05 13#91': 'closed_by_others',
  'qa-user-1-2026-11-05 5#1066': 'closed_by_others',
  'system_analyst-user-13-2026-10-29 8#686': 'new_signal',
  'system_analyst-user-13-2026-10-30 6#2659': 'new_signal',
  'system_analyst-user-13-2026-11-02 6#2662': 'closed_by_others',
  'system_analyst-user-13-2026-11-02 9#66': 'new_signal',
  'system_analyst-user-13-2026-11-02 11#609': 'new_signal',
  'system_analyst-user-13-2026-11-03 6#2645': 'closed_by_others',
  'system_analyst-user-13-2026-11-04 10#178': 'closed_by_others',
  'system_analyst-user-13-2026-11-04 9#66': 'new_signal',
  'system_analyst-user-13-2026-11-04 11#609': 'new_signal',
  'system_analyst-user-13-2026-11-05 6#2660': 'closed_by_others',
};

function toKey({ line }: ActivityResult) {
  const item = line.issue ?? line.mergeRequests.at(0);
  if (!item) {
    return `push:${line.pushes[0].projectId}:${line.pushes[0].ref}`;
  }
  return `${item.projectId}${line.issue ? '#' : '!'}${item.iid}`;
}

export function isAcceptedByV1(status: string, main: ActivityCandidate) {
  return (GOLDEN_ACCEPTED[status] ?? []).some(
    ([action, state]) => main.action === action && (state === undefined || main.state === state),
  );
}

export function classifyGoldenDays() {
  const index = createGoldenIndex();
  const service = createService();
  const unused: string[] = [];
  const lines = loadGoldenDays().flatMap((golden) => {
    const verdicts = new Map<string, GoldenVerdict>([
      ...golden.verdicts.issues.map((verdict): [string, GoldenVerdict] => [
        `${verdict.projectId}#${verdict.iid}`,
        verdict,
      ]),
      ...golden.verdicts.standaloneMergeRequests.map((verdict): [string, GoldenVerdict] => [
        `${verdict.projectId}!${verdict.iid}`,
        verdict,
      ]),
      ...golden.verdicts.standalonePushes.map((verdict): [string, GoldenVerdict] => [
        `push:${verdict.projectId}:${verdict.branch}`,
        verdict,
      ]),
    ]);
    const results = service.classify(
      golden.day,
      { username: golden.username, role: golden.role },
      index,
    );
    const keys = new Set(results.map(toKey));
    unused.push(
      ...[...verdicts.keys()].filter((key) => !keys.has(key)).map((key) => `${golden.name} ${key}`),
    );
    return results.map((result) => ({
      key: `${golden.name} ${toKey(result)}`,
      status: verdicts.get(toKey(result))?.status ?? null,
      result,
    }));
  });
  return { lines, unused };
}
