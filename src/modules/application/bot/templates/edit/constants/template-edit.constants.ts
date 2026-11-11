import { z } from 'zod';
import { TEMPLATE_BODY_MAX_LENGTH } from 'src/modules/application/report/template/constants/template.constants';
import { BotNamespace } from '../../../core/types/bot.enums';
import { TemplateEditAction, TemplateEditStep } from '../types/template-edit.enums';

const NAMESPACE_SCHEMA = z.literal(BotNamespace.TEMPLATE_EDIT);

export const TEMPLATE_EDIT_BUTTON_SCHEMA = z.union([
  z
    .tuple([NAMESPACE_SCHEMA, z.enum([TemplateEditAction.NAME, TemplateEditAction.TEXT]), z.uuid()])
    .transform(([, action, id]) => ({ action, id })),
  z
    .tuple([NAMESPACE_SCHEMA, z.enum([TemplateEditAction.SAVE, TemplateEditAction.CANCEL])])
    .transform(([, action]) => ({ action })),
]);

export const TEMPLATE_EDIT_TEXT_STEPS: string[] = [TemplateEditStep.BODY, TemplateEditStep.PREVIEW];

export const TEMPLATE_EDIT_DRAFT_SCHEMA = z.object({
  templateId: z.uuid(),
  body: z.string().min(1).max(TEMPLATE_BODY_MAX_LENGTH).optional(),
});
