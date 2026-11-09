import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import { getErrorMessage } from 'src/common/utils/error.util';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import { ReportService } from 'src/modules/application/report/report.service';
import {
  TEMPLATE_BODY_MAX_LENGTH,
  TEMPLATE_NAME_MAX_LENGTH,
} from 'src/modules/application/report/template/constants/template.constants';
import { TemplateService } from 'src/modules/application/report/template/template.service';
import type { User } from 'src/modules/application/user/user.interface';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotNamespace } from '../bot.enums';
import type { BotContext, BotDialog, BotHandler, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { TemplatesAction } from '../templates/templates.enums';
import {
  TEMPLATE_ADD_BUTTON_SCHEMA,
  TEMPLATE_ADD_DATE_FORMAT,
  TEMPLATE_ADD_DATE_TIME_SUFFIX,
  TEMPLATE_ADD_DRAFT_SCHEMA,
} from './constants/template-add.constants';
import { TemplateAddMessages } from './constants/template-add.messages';
import { TemplateAddAction, TemplateAddStep } from './template-add.enums';

@Injectable()
@BotSection({ access: BotAccess.EMPLOYEE, namespace: BotNamespace.TEMPLATE_ADD })
export class TemplateAddHandler implements BotHandler {
  private readonly logger = new Logger(TemplateAddHandler.name);

  constructor(
    private readonly templateService: TemplateService,
    private readonly reportService: ReportService,
  ) {}

  async handle({ actor, input, dialog, locale }: BotContext): Promise<BotReply> {
    const { user } = actor;
    if (!user) {
      return { screen: { text: locale.bot.forbidden } };
    }
    if (input.type === ChatInputType.TEXT && dialog?.step === TemplateAddStep.NAME) {
      return this.receiveName(locale, input.text);
    }
    if (input.type === ChatInputType.TEXT && dialog?.step === TemplateAddStep.BODY) {
      return this.receiveBody(locale, user, dialog, input.text);
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }
    const button = TEMPLATE_ADD_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case TemplateAddAction.START:
        return this.askName(locale);
      case TemplateAddAction.SAVE:
        return this.save(locale, user, dialog);
      case TemplateAddAction.CANCEL:
        return {
          screen: { text: locale.templates.cancelled, buttons: [[this.toMineButton(locale)]] },
          dialog: null,
        };
    }
  }

  private askName(locale: Locale, error?: string): BotReply {
    return {
      screen: {
        text: [...(error ? [error] : []), locale.templates.askName(TEMPLATE_NAME_MAX_LENGTH)].join(
          '\n',
        ),
        buttons: [[this.toCancelButton(locale)]],
      },
      dialog: this.toDialog(TemplateAddStep.NAME, {}),
    };
  }

  private receiveName(locale: Locale, text: string): BotReply {
    const name = text.trim();
    if (name.length === 0 || name.length > TEMPLATE_NAME_MAX_LENGTH) {
      return this.askName(locale, locale.templates.nameInvalid(TEMPLATE_NAME_MAX_LENGTH));
    }
    return this.askBody(locale, name);
  }

  private askBody(locale: Locale, name: string, error?: string): BotReply {
    return {
      screen: {
        text: [
          ...(error ? [error, ''] : []),
          locale.templates.askBody(escapeMarkdown(name), TEMPLATE_BODY_MAX_LENGTH),
        ].join('\n'),
        buttons: [[this.toCancelButton(locale)]],
      },
      dialog: this.toDialog(TemplateAddStep.BODY, { name }),
    };
  }

  private async receiveBody(
    locale: Locale,
    user: User,
    dialog: BotDialog,
    text: string,
  ): Promise<BotReply> {
    const draft = this.readDraft(dialog, TemplateAddStep.BODY);
    if (!draft) {
      return { screen: { text: locale.bot.expired }, dialog: null };
    }
    const { name } = draft;
    const body = text.trim();
    if (body.length === 0 || body.length > TEMPLATE_BODY_MAX_LENGTH) {
      return this.askBody(locale, name, locale.templates.bodyInvalid(TEMPLATE_BODY_MAX_LENGTH));
    }
    const error = this.templateService.check(body);
    if (error) {
      return this.askBody(locale, name, locale.templates.syntaxError(escapeMarkdown(error)));
    }
    const report = await this.reportService.findLatestSnapshot(user.id);
    let preview: string[];
    try {
      preview = report?.snapshot
        ? [
            locale.templates.preview(this.toDate(locale, report.reportDate)),
            '',
            (await this.templateService.render(body, report.snapshot)) ||
              locale.templates.emptyOutput,
          ]
        : [locale.templates.noPreview];
    } catch (renderError) {
      return this.askBody(
        locale,
        name,
        locale.templates.renderError(escapeMarkdown(getErrorMessage(renderError))),
      );
    }
    return {
      screen: {
        text: preview.join('\n'),
        buttons: [
          [
            { text: locale.templates.save, data: this.toData(TemplateAddAction.SAVE) },
            this.toCancelButton(locale),
          ],
        ],
      },
      dialog: this.toDialog(TemplateAddStep.PREVIEW, { name, body }),
    };
  }

  private async save(locale: Locale, user: User, dialog: BotDialog | null): Promise<BotReply> {
    const draft = this.readDraft(dialog, TemplateAddStep.PREVIEW);
    if (!draft?.body) {
      return { screen: { text: locale.bot.expired }, dialog: null };
    }
    const template = await this.templateService.create({
      name: draft.name,
      body: draft.body,
      ownerId: user.id,
    });
    this.logger.log({ userId: user.id, templateId: template.id }, TemplateAddMessages.CREATED);
    return {
      screen: {
        text: locale.templates.saved(escapeMarkdown(template.name)),
        buttons: [
          [
            {
              text: locale.templates.use,
              data: [BotNamespace.TEMPLATES, TemplatesAction.USE, template.id].join(
                BOT_BUTTON_DATA_SEPARATOR,
              ),
            },
            this.toMineButton(locale),
          ],
        ],
      },
      dialog: null,
    };
  }

  private readDraft(dialog: BotDialog | null, step: string) {
    if (dialog?.namespace !== BotNamespace.TEMPLATE_ADD || dialog.step !== step) {
      return null;
    }
    const draft = TEMPLATE_ADD_DRAFT_SCHEMA.safeParse(dialog.data);
    return draft.success ? draft.data : null;
  }

  private toDate(locale: Locale, date: string) {
    return new Intl.DateTimeFormat(locale.phrases.dateLocale, TEMPLATE_ADD_DATE_FORMAT).format(
      new Date(`${date}${TEMPLATE_ADD_DATE_TIME_SUFFIX}`),
    );
  }

  private toDialog(step: TemplateAddStep, data: Record<string, unknown>) {
    return { namespace: BotNamespace.TEMPLATE_ADD, step, data };
  }

  private toCancelButton(locale: Locale) {
    return { text: locale.templates.cancel, data: this.toData(TemplateAddAction.CANCEL) };
  }

  private toMineButton(locale: Locale) {
    return {
      text: locale.templates.backToMine,
      data: [BotNamespace.TEMPLATES, TemplatesAction.MINE].join(BOT_BUTTON_DATA_SEPARATOR),
    };
  }

  private toData(...parts: string[]) {
    return [BotNamespace.TEMPLATE_ADD, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
