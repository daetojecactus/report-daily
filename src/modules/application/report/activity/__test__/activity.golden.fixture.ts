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
  const index: TraitIndex = new Map();
  for (const [name, dimension, value] of MAPPINGS) {
    index.set(toSourceKey(name), [...(index.get(toSourceKey(name)) ?? []), { dimension, value }]);
  }
  return index;
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
