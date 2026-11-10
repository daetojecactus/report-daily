import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import type { ScreenButton } from 'src/common/interfaces/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import { TemplateService } from 'src/modules/application/report/template/template.service';
import { Permission } from 'src/modules/application/user/user.enums';
import { UserService } from 'src/modules/application/user/user.service';
import { ADMIN_MENU_DATA } from '../admin/constants/admin.constants';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotNamespace } from '../bot.enums';
import type { BotActor, BotContext, BotHandler, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { TemplateAddAction } from '../template-add/template-add.enums';
import { SHARED_TEMPLATES_BUTTON_SCHEMA } from './constants/shared-templates.constants';
import { SharedTemplatesMessages } from './constants/shared-templates.messages';
import { SharedTemplatesAction } from './shared-templates.enums';

@Injectable()
@BotSection({ access: Permission.TEMPLATES, namespace: BotNamespace.SHARED_TEMPLATES })
export class SharedTemplatesHandler implements BotHandler {
  private readonly logger = new Logger(SharedTemplatesHandler.name);

  constructor(
    private readonly templateService: TemplateService,
    private readonly userService: UserService,
  ) {}

  async handle({ actor, input, locale }: BotContext): Promise<BotReply> {
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }
    const button = SHARED_TEMPLATES_BUTTON_SCHEMA.safeParse(
      input.data.split(BOT_BUTTON_DATA_SEPARATOR),
    );
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case SharedTemplatesAction.LIST:
        return this.showList(locale);
      case SharedTemplatesAction.CARD:
        return this.showCard(locale, button.data.id);
      case SharedTemplatesAction.DELETE:
        return this.confirmDelete(locale, button.data.id);
      case SharedTemplatesAction.CONFIRM_DELETE:
        return this.delete(actor, locale, button.data.id);
    }
  }

  private async showList(locale: Locale, notice?: string): Promise<BotReply> {
    const texts = locale.sharedTemplates;
    const templates = await this.templateService.findShared();
    return this.reply(
      [
        ...(notice ? [notice, ''] : []),
        texts.title(templates.length),
        templates.length ? texts.hint : texts.empty,
      ],
      [
        ...templates.map(({ id, name }) => [
          { text: name, data: this.toData(SharedTemplatesAction.CARD, id) },
        ]),
        [
          {
            text: texts.create,
            data: [BotNamespace.TEMPLATE_ADD, TemplateAddAction.SHARED].join(
              BOT_BUTTON_DATA_SEPARATOR,
            ),
          },
          { text: texts.menu, data: ADMIN_MENU_DATA },
        ],
      ],
    );
  }

  private async showCard(locale: Locale, id: string): Promise<BotReply> {
    const template = await this.templateService.findSharedById(id);
    if (!template) {
      return this.showList(locale, locale.templates.notFound);
    }
    const texts = locale.sharedTemplates;
    const users = await this.userService.countByTemplate(template.id);
    return this.reply(
      [
        `**${escapeMarkdown(template.name)}**`,
        texts.usedBy(users),
        '',
        escapeMarkdown(template.body),
      ],
      [
        [{ text: locale.templates.delete, data: this.toData(SharedTemplatesAction.DELETE, id) }],
        [{ text: texts.backToList, data: this.toData(SharedTemplatesAction.LIST) }],
      ],
    );
  }

  private async confirmDelete(locale: Locale, id: string): Promise<BotReply> {
    const template = await this.templateService.findSharedById(id);
    if (!template) {
      return this.showList(locale, locale.templates.notFound);
    }
    const users = await this.userService.countByTemplate(template.id);
    return this.reply(
      [locale.sharedTemplates.confirmDelete(escapeMarkdown(template.name), users)],
      [
        [
          {
            text: locale.templates.confirm,
            data: this.toData(SharedTemplatesAction.CONFIRM_DELETE, id),
          },
          { text: locale.templates.cancel, data: this.toData(SharedTemplatesAction.CARD, id) },
        ],
      ],
    );
  }

  private async delete(actor: BotActor, locale: Locale, id: string): Promise<BotReply> {
    const template = await this.templateService.deleteShared(id);
    if (!template) {
      return this.showList(locale, locale.templates.notFound);
    }
    this.logger.log(
      { templateId: id, actorId: actor.user?.id ?? BotAccess.OWNER },
      SharedTemplatesMessages.DELETED,
    );
    return this.showList(locale, locale.templates.deleted(escapeMarkdown(template.name)));
  }

  private reply(lines: string[], buttons: ScreenButton[][]): BotReply {
    return { screen: { text: lines.join('\n'), buttons }, dialog: null };
  }

  private toData(...parts: string[]) {
    return [BotNamespace.SHARED_TEMPLATES, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
