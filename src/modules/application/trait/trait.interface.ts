import type { Source } from 'src/modules/application/source/source.enums';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { JobRole } from 'src/modules/application/user/user.enums';
import type {
  TraitDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from './trait.enums';
import type { traitMappings } from './trait.schema';

export type TraitMapping = typeof traitMappings.$inferSelect;

export type TraitMappingInsert = typeof traitMappings.$inferInsert;

export type TraitMappingUpdate = PgUpdateSetSource<typeof traitMappings>;

export interface TraitDimensionValueMap {
  [TraitDimension.WORKFLOW_STATE]: WorkflowState;
  [TraitDimension.TASK_KIND]: TaskKind;
  [TraitDimension.PRIORITY]: Priority;
  [TraitDimension.SEVERITY]: Severity;
  [TraitDimension.AREA]: TaskArea;
  [TraitDimension.FLAG]: TaskFlag;
}

export type TraitValue = TraitDimensionValueMap[TraitDimension];

export interface TraitMappingInput {
  source: Source;
  sourceName: string;
  role: JobRole | null;
  dimension: TraitDimension;
  value: TraitValue;
}

export interface TraitPair {
  dimension: TraitDimension;
  value: TraitValue;
}

export interface TraitIndex {
  pairs: Map<string, TraitPair[]>;
  ignored: Set<string>;
}

export interface TaskTraits {
  workflowStates: WorkflowState[];
  kinds: TaskKind[];
  priority: Priority | null;
  severity: Severity | null;
  areas: TaskArea[];
  flags: TaskFlag[];
}
