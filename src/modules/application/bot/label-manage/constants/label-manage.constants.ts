import { z } from 'zod';
import { BotNamespace } from '../../bot.enums';
import { LabelManageAction } from '../label-manage.enums';

export const LABEL_MANAGE_CURRENT_MARK = '✓ ';

export const LABEL_MANAGE_BUTTONS_PER_ROW = 2;

const NAMESPACE_SCHEMA = z.literal(BotNamespace.LABEL_MANAGE);

const INDEX_SCHEMA = z
  .string()
  .regex(/^\d{1,2}$/)
  .transform(Number);

export const LABEL_MANAGE_BUTTON_SCHEMA = z.union([
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.enum([
        LabelManageAction.OPEN,
        LabelManageAction.DELETE,
        LabelManageAction.DROP,
        LabelManageAction.CONFIRM_DROP,
      ]),
      z.uuid(),
    ])
    .transform(([, action, id]) => ({ action, id })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.literal(LabelManageAction.SET),
      z.uuid(),
      INDEX_SCHEMA,
    ])
    .transform(([, action, id, index]) => ({ action, id, index })),
]);
