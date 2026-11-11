import { z } from 'zod';
import { BotNamespace } from '../../types/bot.enums';
import { TraitsAction } from '../types/traits.enums';

export const TRAITS_PAGE_SIZE = 8;

export const TRAITS_ITEM_SEPARATOR = ' · ';

export const TRAITS_VALUE_PREFIX = '• ';

export const TRAITS_BUTTONS_PER_ROW = 2;

const PAGE_SCHEMA = z
  .string()
  .regex(/^\d{1,4}$/)
  .transform(Number);

export const TRAITS_BUTTON_SCHEMA = z.union([
  z
    .tuple([z.literal(BotNamespace.TRAITS), z.literal(TraitsAction.LIST), PAGE_SCHEMA])
    .transform(([, action, page]) => ({ action, page })),
  z
    .tuple([z.literal(BotNamespace.TRAITS), z.literal(TraitsAction.CARD), z.uuid(), PAGE_SCHEMA])
    .transform(([, action, id, page]) => ({ action, id, page })),
]);
