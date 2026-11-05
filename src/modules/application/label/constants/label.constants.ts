import {
  LabelDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from '../label.enums';
import type { LabelDimensionValueMap } from '../label.interface';

export const LABEL_MAX_LENGTH = 255;

export const LABEL_DICTIONARY: {
  [Dimension in LabelDimension]: readonly LabelDimensionValueMap[Dimension][];
} = {
  [LabelDimension.WORKFLOW_STATE]: Object.values(WorkflowState),
  [LabelDimension.TASK_KIND]: Object.values(TaskKind),
  [LabelDimension.PRIORITY]: Object.values(Priority),
  [LabelDimension.SEVERITY]: Object.values(Severity),
  [LabelDimension.AREA]: Object.values(TaskArea),
  [LabelDimension.FLAG]: Object.values(TaskFlag),
};
