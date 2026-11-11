import { TaskKind } from 'src/modules/application/trait/types/trait.enums';

export const ACTIVITY_CONVENTIONAL_PATTERN =
  /^(?:(?:draft|wip):\s*|\[(?:draft|wip)\]\s*)*([a-z]+)(?:\(([^)]*)\))?!?:\s/i;

export const ACTIVITY_CONVENTIONAL_DEPENDENCY_SCOPE = /^deps(?:-dev)?$/i;

export const ACTIVITY_CONVENTIONAL_KINDS = new Map<string, TaskKind>([
  ['feat', TaskKind.FEATURE],
  ['fix', TaskKind.BUG],
  ['docs', TaskKind.DOCUMENTATION],
  ['test', TaskKind.TEST_AUTOMATION],
  ['refactor', TaskKind.MAINTENANCE],
]);

export const ACTIVITY_TEST_COMMIT_PATTERN =
  /(?<![\p{L}\p{N}_])(?:test|tests|testing|e2e|spec|specs|autotest|autotests|pom|fixture|fixtures|cypress|playwright|selenium|тест|тесты|автотест|автотесты)(?![\p{L}\p{N}_])/iu;

export const ACTIVITY_VERSION_TAG_PATTERN = /\d+\.\d+|(?:^|[^a-z])v\d+/i;

export const ACTIVITY_DEPENDENCY_BRANCH_PATTERN = /^(?:renovate|dependabot)[/-]/i;
