import { z } from 'zod';
import { BotNamespace } from '../../bot.enums';
import { TemplatesAction } from '../templates.enums';

export const TEMPLATES_STANDARD = 'std';

export const TEMPLATES_CURRENT_MARK = '✓ ';

const NAMESPACE_SCHEMA = z.literal(BotNamespace.TEMPLATES);

export const TEMPLATES_BUTTON_SCHEMA = z.union([
  z
    .tuple([NAMESPACE_SCHEMA, z.enum([TemplatesAction.MENU, TemplatesAction.MINE])])
    .transform(([, action]) => ({ action })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.literal(TemplatesAction.USE),
      z.union([z.literal(TEMPLATES_STANDARD), z.uuid()]),
    ])
    .transform(([, action, id]) => ({ action, id })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.enum([TemplatesAction.CARD, TemplatesAction.DELETE, TemplatesAction.CONFIRM_DELETE]),
      z.uuid(),
    ])
    .transform(([, action, id]) => ({ action, id })),
]);

export const TEMPLATES_DATE_TIME_SUFFIX = 'T00:00:00Z';

export const TEMPLATES_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
};
