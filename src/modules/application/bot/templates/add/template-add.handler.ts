import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import {
  TEMPLATE_BODY_MAX_LENGTH,
  TEMPLATE_NAME_MAX_LENGTH,
} from 'src/modules/application/report/template/constants/template.constants';
import { TemplateService } from 'src/modules/application/report/template/template.service';
import { Permission } from 'src/modules/application/user/types/user.enums';
import { BotSection } from '../../core/bot.decorator';
import { BotAccess, BotNamespace } from '../../core/types/bot.enums';
import { AccessService } from '../../core/access.service';
import type {
  BotActor,
  BotContext,
  BotDialog,
  BotHandler,
  BotReply,
} from '../../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../../core/constants/bot.constants';
import { SharedTemplatesAction } from '../shared/types/shared-templates.enums';
import { TemplatesDraft } from '../templates.draft';
import { TemplatesAction } from '../types/templates.enums';
import {
  TEMPLATE_ADD_BUTTON_SCHEMA,
  TEMPLATE_ADD_DRAFT_SCHEMA,
  TEMPLATE_ADD_TEXT_STEPS,
} from './constants/template-add.constants';
import { TemplateAddMessages } from './constants/template-add.messages';
import { TemplateAddAction, TemplateAddStep } from './types/template-add.enums';

@Injectable()
@BotSection({ access: BotAccess.ANYONE, namespace: BotNamespace.TEMPLATE_ADD })
export class TemplateAddHandler implements BotHandler {
  private readonly logger = new Logger(TemplateAddHandler.name);

  constructor(
    private readonly templateService: TemplateService,
    private readonly templatesDraft: TemplatesDraft,
    private readonly accessService: AccessService,
  ) {}

  async handle({ actor, input, dialog, locale }: BotContext): Promise<BotReply> {
    const button =
      input.type === ChatInputType.BUTTON
        ? TEMPLATE_ADD_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR))
        : null;
    const shared =
      button?.data?.action === TemplateAddAction.SHARED ||
      (button?.data?.action !== TemplateAddAction.START && this.readShared(dialog));
    if (!this.isPermitted(actor, shared)) {
      return { screen: { text: locale.bot.forbidden }, dialog: null };
    }
    if (input.type === ChatInputType.TEXT && dialog?.step === TemplateAddStep.NAME) {
      return this.receiveName(locale, shared, input.text);
    }
    if (input.type === ChatInputType.TEXT && TEMPLATE_ADD_TEXT_STEPS.includes(dialog?.step ?? '')) {
      return this.receiveBody(locale, actor, dialog, input.text);
    }
    if (!button) {
      return { screen: { text: locale.bot.unknownInput } };
    }
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case TemplateAddAction.START:
      case TemplateAddAction.SHARED:
        return this.askName(locale, shared);
      case TemplateAddAction.TEXT:
        return this.editBody(locale, dialog);
      case TemplateAddAction.SAVE:
        return this.save(locale, actor, dialog);
      case TemplateAddAction.CANCEL:
        return {
          screen: {
            text: locale.templates.cancelled,
            buttons: [[this.toBackButton(locale, shared)]],
          },
          dialog: null,
        };
    }
  }

  private isPermitted(actor: BotActor, shared: boolean) {
    return shared ? this.accessService.isAllowed(actor, Permission.TEMPLATES) : actor.user !== null;
  }

  private readShared(dialog: BotDialog | null) {
    return dialog?.namespace === BotNamespace.TEMPLATE_ADD && dialog.data.shared === true;
  }

  private askName(locale: Locale, shared: boolean, error?: string): BotReply {
    return {
      screen: {
        text: [...(error ? [error] : []), locale.templates.askName(TEMPLATE_NAME_MAX_LENGTH)].join(
          '\n',
        ),
        buttons: [[this.toCancelButton(locale)]],
      },
      dialog: this.toDialog(TemplateAddStep.NAME, { shared }),
    };
  }

  private receiveName(locale: Locale, shared: boolean, text: string): BotReply {
    const name = this.templatesDraft.toName(text);
    if (!name) {
      return this.askName(locale, shared, locale.templates.nameInvalid(TEMPLATE_NAME_MAX_LENGTH));
    }
    return this.askBody(locale, shared, name);
  }

  private askBody(locale: Locale, shared: boolean, name: string, error?: string): BotReply {
    return {
      screen: {
        text: [
          ...(error ? [error, ''] : []),
          locale.templates.askBody(escapeMarkdown(name), TEMPLATE_BODY_MAX_LENGTH),
        ].join('\n'),
        buttons: [[this.toCancelButton(locale)]],
      },
      dialog: this.toDialog(TemplateAddStep.BODY, { shared, name }),
    };
  }

  private editBody(locale: Locale, dialog: BotDialog | null): BotReply {
    const draft = this.readDraft(dialog, TemplateAddStep.PREVIEW);
    return draft
      ? this.askBody(locale, draft.shared, draft.name)
      : { screen: { text: locale.bot.expired }, dialog: null };
  }

  private async receiveBody(
    locale: Locale,
    actor: BotActor,
    dialog: BotDialog | null,
    text: string,
  ): Promise<BotReply> {
    const draft = this.readDraft(dialog, ...TEMPLATE_ADD_TEXT_STEPS);
    if (!draft) {
      return { screen: { text: locale.bot.expired }, dialog: null };
    }
    const { shared, name } = draft;
    const { body, error, preview } = await this.templatesDraft.checkBody(locale, actor, text);
    if (error) {
      return this.askBody(locale, shared, name, error);
    }
    return {
      screen: {
        text: preview,
        buttons: [
          [
            { text: locale.templates.save, data: this.toData(TemplateAddAction.SAVE) },
            { text: locale.templates.editText, data: this.toData(TemplateAddAction.TEXT) },
          ],
          [this.toCancelButton(locale)],
        ],
      },
      dialog: this.toDialog(TemplateAddStep.PREVIEW, { shared, name, body }),
    };
  }

  private async save(locale: Locale, actor: BotActor, dialog: BotDialog | null): Promise<BotReply> {
    const draft = this.readDraft(dialog, TemplateAddStep.PREVIEW);
    if (!draft?.body || (!draft.shared && !actor.user)) {
      return { screen: { text: locale.bot.expired }, dialog: null };
    }
    const template = await this.templateService.create({
      name: draft.name,
      body: draft.body,
      ownerId: draft.shared ? null : (actor.user?.id ?? null),
    });
    this.logger.log(
      { templateId: template.id, shared: draft.shared, actorId: actor.user?.id ?? BotAccess.OWNER },
      TemplateAddMessages.CREATED,
    );
    const name = escapeMarkdown(template.name);
    return {
      screen: draft.shared
        ? {
            text: locale.sharedTemplates.saved(name),
            buttons: [[this.toBackButton(locale, true)]],
          }
        : {
            text: locale.templates.saved(name),
            buttons: [
              [
                {
                  text: locale.templates.use,
                  data: [BotNamespace.TEMPLATES, TemplatesAction.USE, template.id].join(
                    BOT_BUTTON_DATA_SEPARATOR,
                  ),
                },
                this.toBackButton(locale, false),
              ],
            ],
          },
      dialog: null,
    };
  }

  private readDraft(dialog: BotDialog | null, ...steps: string[]) {
    if (dialog?.namespace !== BotNamespace.TEMPLATE_ADD || !steps.includes(dialog.step)) {
      return null;
    }
    const draft = TEMPLATE_ADD_DRAFT_SCHEMA.safeParse(dialog.data);
    return draft.success ? draft.data : null;
  }

  private toDialog(step: TemplateAddStep, data: Record<string, unknown>) {
    return { namespace: BotNamespace.TEMPLATE_ADD, step, data };
  }

  private toCancelButton(locale: Locale) {
    return { text: locale.templates.cancel, data: this.toData(TemplateAddAction.CANCEL) };
  }

  private toBackButton(locale: Locale, shared: boolean) {
    return shared
      ? {
          text: locale.sharedTemplates.backToList,
          data: [BotNamespace.SHARED_TEMPLATES, SharedTemplatesAction.LIST].join(
            BOT_BUTTON_DATA_SEPARATOR,
          ),
        }
      : {
          text: locale.templates.backToMine,
          data: [BotNamespace.TEMPLATES, TemplatesAction.MINE].join(BOT_BUTTON_DATA_SEPARATOR),
        };
  }

  private toData(...parts: string[]) {
    return [BotNamespace.TEMPLATE_ADD, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
