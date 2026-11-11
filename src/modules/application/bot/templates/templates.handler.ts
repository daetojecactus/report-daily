import { Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ScreenButton } from 'src/common/channel/types/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import { TemplateService } from 'src/modules/application/report/template/template.service';
import type { User } from 'src/modules/application/user/types/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { AccessService } from '../core/access.service';
import { BotSection } from '../core/bot.decorator';
import { BotAccess, BotNamespace } from '../core/types/bot.enums';
import type { BotActor, BotContext, BotHandler, BotReply } from '../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../core/constants/bot.constants';
import { SettingsAction } from '../settings/types/settings.enums';
import { TEMPLATES_BUTTON_SCHEMA, TEMPLATES_STANDARD } from './constants/templates.constants';
import { TemplatesMessages } from './constants/templates.messages';
import { TemplateAddAction } from './add/types/template-add.enums';
import { TemplateEditAction } from './edit/types/template-edit.enums';
import { TemplatesAction } from './types/templates.enums';

@Injectable()
@BotSection({ access: BotAccess.EMPLOYEE, namespace: BotNamespace.TEMPLATES })
export class TemplatesHandler implements BotHandler {
  private readonly logger = new Logger(TemplatesHandler.name);

  constructor(
    private readonly templateService: TemplateService,
    private readonly userService: UserService,
    private readonly accessService: AccessService,
  ) {}

  async handle({ actor, input, locale }: BotContext): Promise<BotReply> {
    const { user } = actor;
    if (!user) {
      return { screen: { text: locale.bot.forbidden } };
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }
    const button = TEMPLATES_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR));
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case TemplatesAction.MENU:
        return this.showMenu(locale, user);
      case TemplatesAction.USE:
        return this.use(locale, user, button.data.id);
      case TemplatesAction.MINE:
        return this.showMine(locale, user);
      case TemplatesAction.CARD:
        return this.showCard(locale, user, button.data.id, this.canShare(actor));
      case TemplatesAction.DELETE:
        return this.confirmDelete(locale, user, button.data.id);
      case TemplatesAction.CONFIRM_DELETE:
        return this.delete(locale, user, button.data.id);
      case TemplatesAction.SHARE:
        return this.canShare(actor)
          ? this.confirmShare(locale, user, button.data.id)
          : { screen: { text: locale.bot.forbidden } };
      case TemplatesAction.CONFIRM_SHARE:
        return this.canShare(actor)
          ? this.share(locale, user, button.data.id)
          : { screen: { text: locale.bot.forbidden } };
    }
  }

  private async showMenu(locale: Locale, user: User, notice?: string): Promise<BotReply> {
    const texts = locale.templates;
    const templates = await this.templateService.findAvailable(user.id);
    const current = templates.find((template) => template.id === user.templateId) ?? null;
    const choices = [
      { id: TEMPLATES_STANDARD, name: texts.standard },
      ...templates.map(({ id, name, ownerId }) => ({
        id,
        name: ownerId ? name : texts.shared(name),
      })),
    ];
    return this.reply(
      [...(notice ? [notice, ''] : []), texts.title, texts.current(this.toName(locale, current))],
      [
        ...choices.map(({ id, name }) => [
          {
            text: id === (current?.id ?? TEMPLATES_STANDARD) ? texts.selected(name) : name,
            data: this.toData(TemplatesAction.USE, id),
          },
        ]),
        [
          { text: texts.mine, data: this.toData(TemplatesAction.MINE) },
          {
            text: texts.toSettings,
            data: [BotNamespace.SETTINGS, SettingsAction.MENU].join(BOT_BUTTON_DATA_SEPARATOR),
          },
        ],
      ],
    );
  }

  private async use(locale: Locale, user: User, id: string): Promise<BotReply> {
    const template = id === TEMPLATES_STANDARD ? null : await this.templateService.findById(id);
    if (
      id !== TEMPLATES_STANDARD &&
      (!template || !this.templateService.isAvailable(template, user.id))
    ) {
      return this.showMenu(locale, user, locale.templates.notFound);
    }
    const updated =
      (await this.userService.updateSettings(user.id, { templateId: template?.id ?? null })) ??
      user;
    this.logger.log(
      { userId: user.id, templateId: template?.id ?? null },
      TemplatesMessages.CHOSEN,
    );
    return this.showMenu(locale, updated, locale.templates.chosen(this.toName(locale, template)));
  }

  private async showMine(locale: Locale, user: User, notice?: string): Promise<BotReply> {
    const texts = locale.templates;
    const templates = await this.templateService.findOwn(user.id);
    return this.reply(
      [
        ...(notice ? [notice, ''] : []),
        texts.mineTitle(templates.length),
        ...(templates.length ? [] : [texts.mineEmpty]),
      ],
      [
        ...templates.map(({ id, name }) => [
          { text: name, data: this.toData(TemplatesAction.CARD, id) },
        ]),
        [
          {
            text: texts.create,
            data: [BotNamespace.TEMPLATE_ADD, TemplateAddAction.START].join(
              BOT_BUTTON_DATA_SEPARATOR,
            ),
          },
          { text: texts.back, data: this.toData(TemplatesAction.MENU) },
        ],
      ],
    );
  }

  private async showCard(
    locale: Locale,
    user: User,
    id: string,
    canShare: boolean,
  ): Promise<BotReply> {
    const template = await this.templateService.findById(id);
    if (template?.ownerId !== user.id) {
      return this.showMine(locale, user, locale.templates.notFound);
    }
    const texts = locale.templates;
    return this.reply(
      [`**${escapeMarkdown(template.name)}**`, '', escapeMarkdown(template.body)],
      [
        [
          { text: texts.use, data: this.toData(TemplatesAction.USE, template.id) },
          { text: texts.delete, data: this.toData(TemplatesAction.DELETE, template.id) },
        ],
        [
          { text: texts.editText, data: this.toEditData(TemplateEditAction.TEXT, template.id) },
          { text: texts.rename, data: this.toEditData(TemplateEditAction.NAME, template.id) },
        ],
        ...(canShare
          ? [[{ text: texts.makeShared, data: this.toData(TemplatesAction.SHARE, template.id) }]]
          : []),
        [{ text: texts.backToMine, data: this.toData(TemplatesAction.MINE) }],
      ],
    );
  }

  private async confirmDelete(locale: Locale, user: User, id: string): Promise<BotReply> {
    const template = await this.templateService.findById(id);
    if (template?.ownerId !== user.id) {
      return this.showMine(locale, user, locale.templates.notFound);
    }
    return this.reply(
      [locale.templates.confirmDelete(escapeMarkdown(template.name))],
      [
        [
          { text: locale.templates.confirm, data: this.toData(TemplatesAction.CONFIRM_DELETE, id) },
          { text: locale.templates.cancel, data: this.toData(TemplatesAction.CARD, id) },
        ],
      ],
    );
  }

  private async delete(locale: Locale, user: User, id: string): Promise<BotReply> {
    const template = await this.templateService.deleteOwn(id, user.id);
    if (!template) {
      return this.showMine(locale, user, locale.templates.notFound);
    }
    this.logger.log({ userId: user.id, templateId: id }, TemplatesMessages.DELETED);
    return this.showMine(locale, user, locale.templates.deleted(escapeMarkdown(template.name)));
  }

  private async confirmShare(locale: Locale, user: User, id: string): Promise<BotReply> {
    const template = await this.templateService.findById(id);
    if (template?.ownerId !== user.id) {
      return this.showMine(locale, user, locale.templates.notFound);
    }
    return this.reply(
      [locale.templates.confirmShare(escapeMarkdown(template.name))],
      [
        [
          {
            text: locale.templates.confirmMakeShared,
            data: this.toData(TemplatesAction.CONFIRM_SHARE, id),
          },
          { text: locale.templates.cancel, data: this.toData(TemplatesAction.CARD, id) },
        ],
      ],
    );
  }

  private async share(locale: Locale, user: User, id: string): Promise<BotReply> {
    const template = await this.templateService.share(id, user.id);
    if (!template) {
      return this.showMine(locale, user, locale.templates.notFound);
    }
    this.logger.log({ userId: user.id, templateId: id }, TemplatesMessages.SHARED);
    return this.showMine(locale, user, locale.templates.madeShared(escapeMarkdown(template.name)));
  }

  private canShare(actor: BotActor) {
    return this.accessService.isAllowed(actor, BotAccess.ADMIN);
  }

  private toName(locale: Locale, template: { name: string; ownerId: string | null } | null) {
    if (!template) {
      return locale.templates.standard;
    }
    const name = escapeMarkdown(template.name);
    return template.ownerId ? name : locale.templates.shared(name);
  }

  private reply(lines: string[], buttons: ScreenButton[][]): BotReply {
    return { screen: { text: lines.join('\n'), buttons }, dialog: null };
  }

  private toEditData(action: TemplateEditAction, id: string) {
    return [BotNamespace.TEMPLATE_EDIT, action, id].join(BOT_BUTTON_DATA_SEPARATOR);
  }

  private toData(...parts: string[]) {
    return [BotNamespace.TEMPLATES, ...parts].join(BOT_BUTTON_DATA_SEPARATOR);
  }
}
