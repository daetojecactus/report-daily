import {
  TraitDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from '../trait.enums';
import type { TraitDimensionValueMap } from '../trait.interface';

export const TRAIT_SOURCE_NAME_MAX_LENGTH = 255;

export const TRAIT_DICTIONARY: {
  [Dimension in TraitDimension]: readonly TraitDimensionValueMap[Dimension][];
} = {
  [TraitDimension.WORKFLOW_STATE]: Object.values(WorkflowState),
  [TraitDimension.TASK_KIND]: Object.values(TaskKind),
  [TraitDimension.PRIORITY]: Object.values(Priority),
  [TraitDimension.SEVERITY]: Object.values(Severity),
  [TraitDimension.AREA]: Object.values(TaskArea),
  [TraitDimension.FLAG]: Object.values(TaskFlag),
};

export const TRAIT_STATE_WEIGHTS: Record<WorkflowState, number> = {
  [WorkflowState.BACKLOG]: 280,
  [WorkflowState.PLANNED]: 285,
  [WorkflowState.ANALYSIS]: 295,
  [WorkflowState.DESIGN]: 295,
  [WorkflowState.IN_PROGRESS]: 290,
  [WorkflowState.REVIEW]: 550,
  [WorkflowState.CHANGES_REQUESTED]: 770,
  [WorkflowState.READY_FOR_QA]: 560,
  [WorkflowState.TESTING]: 710,
  [WorkflowState.QA_PASSED]: 790,
  [WorkflowState.READY_FOR_RELEASE]: 650,
  [WorkflowState.STAGING]: 920,
  [WorkflowState.RELEASED]: 930,
  [WorkflowState.DONE]: 935,
  [WorkflowState.CANCELLED]: 925,
  [WorkflowState.BLOCKED]: 860,
  [WorkflowState.NEEDS_INFO]: 530,
  [WorkflowState.HANDOFF]: 540,
};
