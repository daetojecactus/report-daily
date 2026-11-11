import { z } from 'zod';
import { BotNamespace } from '../../../core/types/bot.enums';
import { TraitManageAction } from '../types/trait-manage.enums';

const NAMESPACE_SCHEMA = z.literal(BotNamespace.TRAIT_MANAGE);

const INDEX_SCHEMA = z
  .string()
  .regex(/^\d{1,2}$/)
  .transform(Number);

export const TRAIT_MANAGE_BUTTON_SCHEMA = z.union([
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.enum([
        TraitManageAction.OPEN,
        TraitManageAction.DELETE,
        TraitManageAction.DROP,
        TraitManageAction.CONFIRM_DROP,
      ]),
      z.uuid(),
    ])
    .transform(([, action, id]) => ({ action, id })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(TraitManageAction.SET), z.uuid(), INDEX_SCHEMA])
    .transform(([, action, id, index]) => ({ action, id, index })),
]);
