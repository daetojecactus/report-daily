import { z } from 'zod';
import {
  TraitDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/types/trait.enums';
import type { TraitValue } from 'src/modules/application/trait/types/trait.interface';
import { JobRole } from 'src/modules/application/user/types/user.enums';
import { BotNamespace } from '../../../core/types/bot.enums';
import { TraitAddAction } from '../types/trait-add.enums';

export const TRAIT_ADD_EVERYONE = 'all';

const NAMESPACE_SCHEMA = z.literal(BotNamespace.TRAIT_ADD);

export const TRAIT_ADD_VALUE_SCHEMAS: Record<TraitDimension, z.ZodType<TraitValue>> = {
  [TraitDimension.WORKFLOW_STATE]: z.enum(WorkflowState),
  [TraitDimension.TASK_KIND]: z.enum(TaskKind),
  [TraitDimension.PRIORITY]: z.enum(Priority),
  [TraitDimension.SEVERITY]: z.enum(Severity),
  [TraitDimension.AREA]: z.enum(TaskArea),
  [TraitDimension.FLAG]: z.enum(TaskFlag),
};

export const TRAIT_ADD_BUTTON_SCHEMA = z.union([
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(TraitAddAction.START)])
    .transform(([, action]) => ({ action })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.union([z.literal(TraitAddAction.MORE), z.literal(TraitAddAction.NAME)]),
      z.uuid(),
    ])
    .transform(([, action, id]) => ({ action, id })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.literal(TraitAddAction.ROLE),
      z.union([z.literal(TRAIT_ADD_EVERYONE), z.enum(JobRole)]),
    ])
    .transform(([, action, role]) => ({
      action,
      role: role === TRAIT_ADD_EVERYONE ? null : role,
    })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(TraitAddAction.DIMENSIONS)])
    .transform(([, action]) => ({ action })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(TraitAddAction.DIMENSION), z.enum(TraitDimension)])
    .transform(([, action, dimension]) => ({ action, dimension })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(TraitAddAction.VALUE), z.string().min(1)])
    .transform(([, action, value]) => ({ action, value })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(TraitAddAction.CANCEL)])
    .transform(([, action]) => ({ action })),
]);

export const TRAIT_ADD_DRAFT_SCHEMA = z.object({
  label: z.string().min(1),
  role: z.enum(JobRole).nullable().optional(),
  dimension: z.enum(TraitDimension).optional(),
});
