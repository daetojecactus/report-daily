import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import {
  TEMPLATE_BODY_MAX_LENGTH,
  TEMPLATE_NAME_MAX_LENGTH,
} from 'src/modules/application/report/template/constants/template.constants';
import type { ReportTemplate } from 'src/modules/application/report/template/template.interface';
import { TemplateService } from 'src/modules/application/report/template/template.service';
import { Permission } from 'src/modules/application/user/user.enums';
import { AccessService } from '../access/access.service';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotNamespace } from '../bot.enums';
import type { BotActor, BotContext, BotDialog, BotHandler, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { SharedTemplatesAction } from '../shared-templates/shared-templates.enums';
import { TemplatesDraft } from '../templates/templates.draft';
import { TemplatesAction } from '../templates/templates.enums';
import {
  TEMPLATE_EDIT_BUTTON_SCHEMA,
  TEMPLATE_EDIT_DRAFT_SCHEMA,
  TEMPLATE_EDIT_TEXT_STEPS,
} from './constants/template-edit.constants';
import { TemplateEditMessages } from './constants/template-edit.messages';
import { TemplateEditAction, TemplateEditStep } from './template-edit.enums';

@Injectable()
@BotSection({ access: BotAccess.ANYONE, namespace: BotNamespace.TEMPLATE_EDIT })
export class TemplateEditHandler implements BotHandler {
  private readonly logger = new Logger(TemplateEditHandler.name);

  constructor(
    private readonly templateService: TemplateService,
    private readonly templatesDraft: TemplatesDraft,
    private readonly accessService: AccessService,
  ) {}

  async handle({ actor, input, dialog, locale }: BotContext): Promise<BotReply> {
    const button =
      input.type === ChatInputType.BUTTON
        ? TEMPLATE_EDIT_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR))
        : null;
    if (button && !button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    const templateId = button?.data && 'id' in button.data ? button.data.id : this.readId(dialog);
    const template = templateId ? await this.templateService.findById(templateId) : null;
    if (!template || !this.canEdit(actor, template)) {
      return { screen: { text: locale.templates.notFound }, dialog: null };
    }
    if (input.type === ChatInputType.TEXT && dialog?.step === TemplateEditStep.NAME) {
      return this.rename(actor, locale, template, input.text);
    }
    if (
      input.type === ChatInputType.TEXT &&
      TEMPLATE_EDIT_TEXT_STEPS.includes(dialog?.step ?? '')
    ) {
      return this.checkBody(locale, actor, template, input.text);
    }
    switch (button?.data.action) {
      case TemplateEditAction.NAME:
        return this.askName(locale, template);
      case TemplateEditAction.TEXT:
        return this.askBody(locale, template);
      case TemplateEditAction.SAVE:
        return this.save(actor, locale, template, dialog);
      case TemplateEditAction.CANCEL:
        return this.reply(locale.templates.editCancelled, template, locale);
      default:
        return { screen: { text: locale.bot.unknownInput } };
    }
  }

  private canEdit(actor: BotActor, template: ReportTemplate) {
    return template.ownerId === null
      ? this.accessService.isAllowed(actor, Permission.TEMPLATES)
      : actor.user?.id === template.ownerId;
  }

  private askName(locale: Locale, template: ReportTemplate, error?: string): BotReply {
    return {
      screen: {
        text: [
          ...(error ? [error] : []),
          locale.templates.askNewName(escapeMarkdown(template.name), TEMPLATE_NAME_MAX_LENGTH),
        ].join('\n'),
        buttons: [[this.toCancelButton(locale)]],
      },
      dialog: this.toDialog(TemplateEditStep.NAME, { templateId: template.id }),
    };
  }

  private async rename(
    actor: BotActor,
    locale: Locale,
    template: ReportTemplate,
    text: string,
  ): Promise<BotReply> {
    const name = this.templatesDraft.toName(text);
    if (!name) {
      return this.askName(locale, template, locale.templates.nameInvalid(TEMPLATE_NAME_MAX_LENGTH));
    }
    await this.templateService.rename(template.id, name);
    this.log(actor, template, TemplateEditMessages.RENAMED);
    return this.reply(locale.templates.renamed(escapeMarkdown(name)), template, locale);
  }

  private askBody(locale: Locale, template: ReportTemplate, error?: string): BotReply {
    return {
      screen: {
        text: [
          ...(error ? [error, ''] : []),
          locale.templates.askBody(escapeMarkdown(template.name), TEMPLATE_BODY_MAX_LENGTH),
        ].join('\n'),
        buttons: [[this.toCancelButton(locale)]],
      },
      dialog: this.toDialog(TemplateEditStep.BODY, { templateId: template.id }),
    };
  }

  private async checkBody(
    locale: Locale,
    actor: BotActor,
    template: ReportTemplate,
    text: string,
  ): Promise<BotReply> {
    const { body, error, preview } = await this.templatesDraft.checkBody(locale, actor, text);
    if (error) {
      return this.askBody(locale, template, error);
    }
    return {
      screen: {
        text: preview,
        buttons: [
          [
            { text: locale.templates.save, data: this.toData(TemplateEditAction.SAVE) },
            {
              text: locale.templates.editText,
              data: this.toData(TemplateEditAction.TEXT, template.id),
            },
          ],
          [this.toCancelButton(locale)],
        ],
      },
      dialog: this.toDialog(TemplateEditStep.PREVIEW, { templateId: template.id, body }),
    };
  }

  private async save(
    actor: BotActor,
    locale: Locale,
    template: ReportTemplate,
    dialog: BotDialog | null,
  ): Promise<BotReply> {
    const draft = this.readDraft(dialog, TemplateEditStep.PREVIEW);
    if (!draft?.body) {
      return { screen: { text: locale.bot.expired }, dialog: null };
    }
    await this.templateService.replaceBody(template.id, draft.body);
    this.log(actor, template, TemplateEditMessages.BODY_REPLACED);
    return this.reply(
      locale.templates.bodyReplaced(escapeMarkdown(template.name)),
      template,
      locale,
    );
  }

  private readId(dialog: BotDialog | null) {
    return dialog?.namespace === BotNamespace.TEMPLATE_EDIT
      ? (TEMPLATE_EDIT_DRAFT_SCHEMA.safeParse(dialog.data).data?.templateId ?? null)
      : null;
  }

  private readDraft(dialog: BotDialog | null, step: string) {
    if (dialog?.namespace !== BotNamespace.TEMPLATE_EDIT || dialog.step !== step) {
      return null;
    }
    const draft = TEMPLATE_EDIT_DRAFT_SCHEMA.safeParse(dialog.data);
    return draft.success ? draft.data : null;
  }

  private reply(text: string, template: ReportTemplate, locale: Locale): BotReply {
    const card: ScreenButton =
      template.ownerId === null
        ? {
            text: locale.templates.backToTemplate,
            data: [BotNamespace.SHARED_TEMPLATES, SharedTemplatesAction.CARD, template.id].join(
              BOT_BUTTON_DATA_SEPARATOR,
            ),
          }
        : {
            text: locale.templates.backToTemplate,
            data: [BotNamespace.TEMPLATES, TemplatesAction.CARD, template.id].join(
              BOT_BUTTON_DATA_SEPARATOR,
            ),
          };
    return { screen: { text, buttons: [[card]] }, dialog: null };
  }

  private log(actor: BotActor, template: ReportTemplate, message: TemplateEditMessages) {
    this.logger.log(
      {
        templateId: template.id,
        shared: template.ownerId === null,
        actorId: actor.user?.id ?? BotAccess.OWNER,
      },
      message,
    );
  }

  private toDialog(step: TemplateEditStep, data: Record<string, unknown>) {
    return { namespace: BotNamespace.TEMPLATE_EDIT, step, data };
  }

  private toCancelButton(locale: Locale) {
    return { text: locale.templates.cancel, data: this.toData(TemplateEditAction.CANCEL) };
  }

  private toData(...parts: string[]) {
    return [BotNamespace.TEMPLATE_EDIT, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
