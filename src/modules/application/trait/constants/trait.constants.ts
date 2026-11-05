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
