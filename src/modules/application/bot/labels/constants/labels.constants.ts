import { z } from 'zod';
import { BotNamespace } from '../../bot.enums';
import { LabelsAction } from '../labels.enums';

export const LABELS_PAGE_SIZE = 8;

export const LABELS_ITEM_SEPARATOR = ' · ';

export const LABELS_VALUE_PREFIX = '• ';

const PAGE_SCHEMA = z
  .string()
  .regex(/^\d{1,4}$/)
  .transform(Number);

export const LABELS_BUTTON_SCHEMA = z.union([
  z
    .tuple([
      z.literal(BotNamespace.LABELS),
      z.literal(LabelsAction.LIST),
      PAGE_SCHEMA,
    ])
    .transform(([, action, page]) => ({ action, page })),
  z
    .tuple([
      z.literal(BotNamespace.LABELS),
      z.literal(LabelsAction.CARD),
      z.uuid(),
      PAGE_SCHEMA,
    ])
    .transform(([, action, id, page]) => ({ action, id, page })),
]);
