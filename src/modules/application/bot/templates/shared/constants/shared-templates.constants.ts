import { z } from 'zod';
import { BotNamespace } from '../../../core/types/bot.enums';
import { SharedTemplatesAction } from '../types/shared-templates.enums';

const NAMESPACE_SCHEMA = z.literal(BotNamespace.SHARED_TEMPLATES);

export const SHARED_TEMPLATES_BUTTON_SCHEMA = z.union([
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(SharedTemplatesAction.LIST)])
    .transform(([, action]) => ({ action })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.enum([
        SharedTemplatesAction.CARD,
        SharedTemplatesAction.DELETE,
        SharedTemplatesAction.CONFIRM_DELETE,
      ]),
      z.uuid(),
    ])
    .transform(([, action, id]) => ({ action, id })),
]);
