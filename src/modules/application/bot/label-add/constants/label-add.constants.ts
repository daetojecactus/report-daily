import { z } from 'zod';
import {
  LabelDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/label/label.enums';
import type { LabelValue } from 'src/modules/application/label/label.interface';
import { JobRole } from 'src/modules/application/user/user.enums';
import { BotNamespace } from '../../bot.enums';
import { LabelAddAction } from '../label-add.enums';

export const LABEL_ADD_EVERYONE = 'all';

export const LABEL_ADD_BUTTONS_PER_ROW = 2;

const NAMESPACE_SCHEMA = z.literal(BotNamespace.LABEL_ADD);

export const LABEL_ADD_VALUE_SCHEMAS: Record<
  LabelDimension,
  z.ZodType<LabelValue>
> = {
  [LabelDimension.WORKFLOW_STATE]: z.enum(WorkflowState),
  [LabelDimension.TASK_KIND]: z.enum(TaskKind),
  [LabelDimension.PRIORITY]: z.enum(Priority),
  [LabelDimension.SEVERITY]: z.enum(Severity),
  [LabelDimension.AREA]: z.enum(TaskArea),
  [LabelDimension.FLAG]: z.enum(TaskFlag),
};

export const LABEL_ADD_BUTTON_SCHEMA = z.union([
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(LabelAddAction.START)])
    .transform(([, action]) => ({ action })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(LabelAddAction.MORE), z.uuid()])
    .transform(([, action, id]) => ({ action, id })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.literal(LabelAddAction.ROLE),
      z.union([z.literal(LABEL_ADD_EVERYONE), z.enum(JobRole)]),
    ])
    .transform(([, action, role]) => ({
      action,
      role: role === LABEL_ADD_EVERYONE ? null : role,
    })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(LabelAddAction.DIMENSIONS)])
    .transform(([, action]) => ({ action })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.literal(LabelAddAction.DIMENSION),
      z.enum(LabelDimension),
    ])
    .transform(([, action, dimension]) => ({ action, dimension })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.literal(LabelAddAction.VALUE),
      z.string().min(1),
    ])
    .transform(([, action, value]) => ({ action, value })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(LabelAddAction.CANCEL)])
    .transform(([, action]) => ({ action })),
]);

export const LABEL_ADD_DRAFT_SCHEMA = z.object({
  label: z.string().min(1),
  role: z.enum(JobRole).nullable().optional(),
  dimension: z.enum(LabelDimension).optional(),
});
