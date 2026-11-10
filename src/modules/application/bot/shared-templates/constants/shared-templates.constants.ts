import { z } from 'zod';
import { BotNamespace } from '../../bot.enums';
import { SharedTemplatesAction } from '../shared-templates.enums';

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
