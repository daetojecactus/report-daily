import { describe, expect, it } from 'vitest';
import { toSourceKey } from 'src/common/utils/source-name.util';
import {
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  TraitDimension,
  WorkflowState,
} from '../trait.enums';
import type { TraitIndex, TraitPair } from '../trait.interface';
import type { TraitRepository } from '../trait.repository';
import { TraitService } from '../trait.service';

function createIndex(mappings: Record<string, TraitPair[]>): TraitIndex {
  return new Map(Object.entries(mappings).map(([name, pairs]) => [toSourceKey(name), pairs]));
}

const INDEX = createIndex({
  'type::bug': [{ dimension: TraitDimension.TASK_KIND, value: TaskKind.BUG }],
  bug: [{ dimension: TraitDimension.TASK_KIND, value: TaskKind.BUG }],
  'type::hotfix': [{ dimension: TraitDimension.TASK_KIND, value: TaskKind.HOTFIX }],
  'priority::low': [{ dimension: TraitDimension.PRIORITY, value: Priority.LOW }],
  'priority::critical': [{ dimension: TraitDimension.PRIORITY, value: Priority.CRITICAL }],
  'severity::4': [{ dimension: TraitDimension.SEVERITY, value: Severity.MINOR }],
  'severity::1': [{ dimension: TraitDimension.SEVERITY, value: Severity.BLOCKER }],
  'status::doing': [{ dimension: TraitDimension.WORKFLOW_STATE, value: WorkflowState.IN_PROGRESS }],
  'status::QA passed': [
    { dimension: TraitDimension.WORKFLOW_STATE, value: WorkflowState.QA_PASSED },
  ],
  'qa::returned to development': [
    { dimension: TraitDimension.FLAG, value: TaskFlag.RETURNED_FROM_QA },
  ],
  'needs-rebase': [{ dimension: TraitDimension.FLAG, value: TaskFlag.NEEDS_REBASE }],
  'bug::performance': [
    { dimension: TraitDimension.TASK_KIND, value: TaskKind.BUG },
    { dimension: TraitDimension.AREA, value: TaskArea.PERFORMANCE },
  ],
  'app::server': [{ dimension: TraitDimension.AREA, value: TaskArea.BACKEND }],
});

describe('TraitService', () => {
  const service = new TraitService({} as TraitRepository);

  it('finds the traits of a name in any spelling', () => {
    expect(service.findTraits(INDEX, 'Status::Ready_for QA')).toEqual([]);
    expect(service.findTraits(INDEX, ' Status::QA_Passed ')).toEqual([
      { dimension: TraitDimension.WORKFLOW_STATE, value: WorkflowState.QA_PASSED },
    ]);
  });

  it('treats a scoped and an unscoped name as the team mapped them', () => {
    expect(service.toTaskTraits(INDEX, ['bug']).kinds).toEqual([TaskKind.BUG]);
    expect(service.toTaskTraits(INDEX, ['type::bug']).kinds).toEqual([TaskKind.BUG]);
    expect(service.toTaskTraits(INDEX, ['feature::bug']).kinds).toEqual([]);
  });

  it('tells the same value under different scopes apart', () => {
    expect(service.toTaskTraits(INDEX, ['qa::returned to development']).flags).toEqual([
      TaskFlag.RETURNED_FROM_QA,
    ]);
    expect(service.toTaskTraits(INDEX, ['status::returned to development']).flags).toEqual([]);
  });

  it('knows needs-rebase without a scope', () => {
    expect(service.toTaskTraits(INDEX, ['Needs-Rebase']).flags).toEqual([TaskFlag.NEEDS_REBASE]);
  });

  it('takes the highest priority and severity', () => {
    expect(
      service.toTaskTraits(INDEX, [
        'priority::low',
        'priority::critical',
        'severity::4',
        'severity::1',
      ]),
    ).toMatchObject({ priority: Priority.CRITICAL, severity: Severity.BLOCKER });
  });

  it('keeps all kinds, states, areas and flags in dictionary order', () => {
    expect(
      service.toTaskTraits(INDEX, [
        'bug::performance',
        'type::hotfix',
        'type::bug',
        'app::server',
        'status::QA passed',
        'status::doing',
        'needs-rebase',
        'qa::returned to development',
      ]),
    ).toEqual({
      workflowStates: [WorkflowState.IN_PROGRESS, WorkflowState.QA_PASSED],
      kinds: [TaskKind.HOTFIX, TaskKind.BUG],
      priority: null,
      severity: null,
      areas: [TaskArea.BACKEND, TaskArea.PERFORMANCE],
      flags: [TaskFlag.RETURNED_FROM_QA, TaskFlag.NEEDS_REBASE],
    });
  });

  it('gives empty traits to unmapped names', () => {
    expect(service.toTaskTraits(INDEX, ['region::EU'])).toEqual({
      workflowStates: [],
      kinds: [],
      priority: null,
      severity: null,
      areas: [],
      flags: [],
    });
  });
});
