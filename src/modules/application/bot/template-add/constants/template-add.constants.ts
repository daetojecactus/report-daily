import { z } from 'zod';
import {
  TEMPLATE_BODY_MAX_LENGTH,
  TEMPLATE_NAME_MAX_LENGTH,
} from 'src/modules/application/report/template/constants/template.constants';
import { BotNamespace } from '../../bot.enums';
import { TemplateAddAction } from '../template-add.enums';

export const TEMPLATE_ADD_DATE_TIME_SUFFIX = 'T00:00:00Z';

export const TEMPLATE_ADD_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
};

export const TEMPLATE_ADD_BUTTON_SCHEMA = z
  .tuple([z.literal(BotNamespace.TEMPLATE_ADD), z.enum(TemplateAddAction)])
  .transform(([, action]) => ({ action }));

export const TEMPLATE_ADD_DRAFT_SCHEMA = z.object({
  shared: z.boolean(),
  name: z.string().min(1).max(TEMPLATE_NAME_MAX_LENGTH),
  body: z.string().min(1).max(TEMPLATE_BODY_MAX_LENGTH).optional(),
});
