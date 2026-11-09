import { z } from 'zod';
import { BotNamespace } from '../../bot.enums';
import { TraitNameList, TraitNamesAction } from '../trait-names.enums';

export const TRAIT_NAMES_PAGE_SIZE = 8;

const NAMESPACE_SCHEMA = z.literal(BotNamespace.TRAIT_NAMES);

const PAGE_SCHEMA = z
  .string()
  .regex(/^\d{1,4}$/)
  .transform(Number);

export const TRAIT_NAMES_BUTTON_SCHEMA = z.union([
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(TraitNamesAction.LIST), z.enum(TraitNameList), PAGE_SCHEMA])
    .transform(([, action, list, page]) => ({ action, list, page })),
  z
    .tuple([NAMESPACE_SCHEMA, z.literal(TraitNamesAction.CARD), z.uuid(), PAGE_SCHEMA])
    .transform(([, action, id, page]) => ({ action, id, page })),
  z
    .tuple([
      NAMESPACE_SCHEMA,
      z.union([z.literal(TraitNamesAction.IGNORE), z.literal(TraitNamesAction.RESTORE)]),
      z.uuid(),
      PAGE_SCHEMA,
    ])
    .transform(([, action, id, page]) => ({ action, id, page })),
]);
