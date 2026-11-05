import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type {
  LabelDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from './label.enums';
import type { labelMappings } from './label.schema';

export type LabelMapping = typeof labelMappings.$inferSelect;

export type LabelMappingInsert = typeof labelMappings.$inferInsert;

export type LabelMappingUpdate = PgUpdateSetSource<typeof labelMappings>;

export interface LabelDimensionValueMap {
  [LabelDimension.WORKFLOW_STATE]: WorkflowState;
  [LabelDimension.TASK_KIND]: TaskKind;
  [LabelDimension.PRIORITY]: Priority;
  [LabelDimension.SEVERITY]: Severity;
  [LabelDimension.AREA]: TaskArea;
  [LabelDimension.FLAG]: TaskFlag;
}

export type LabelValue = LabelDimensionValueMap[LabelDimension];
