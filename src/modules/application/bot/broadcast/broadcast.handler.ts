import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChatInputType } from 'src/common/enums/channel.enums';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { DeliveryMode } from 'src/modules/infrastructure/config/config.enums';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { DeliveryTelegramQueueProducer } from 'src/modules/queue/delivery-telegram/delivery-telegram-queue.producer';
import { ADMIN_MENU_DATA } from '../admin/constants/admin.constants';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotNamespace } from '../bot.enums';
import type { BotActor, BotContext, BotDialog, BotHandler, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { BroadcastAction, BroadcastStep } from './broadcast.enums';
import {
  BROADCAST_BUTTON_SCHEMA,
  BROADCAST_DRAFT_SCHEMA,
  BROADCAST_TEXT_MAX_LENGTH,
  BROADCAST_TEXT_STEPS,
} from './constants/broadcast.constants';
import { BroadcastSectionMessages } from './constants/broadcast.messages';

@Injectable()
@BotSection({ access: BotAccess.OWNER, namespace: BotNamespace.BROADCAST })
export class BroadcastHandler implements BotHandler {
  private readonly logger = new Logger(BroadcastHandler.name);
  private readonly redirect: boolean;
  private readonly ownerIds: string[];

  constructor(
    private readonly userService: UserService,
    private readonly deliveryTelegramQueueProducer: DeliveryTelegramQueueProducer,
    configService: ConfigService<AppEnvs, true>,
  ) {
    this.redirect = configService.get('DELIVERY_MODE', { infer: true }) === DeliveryMode.REDIRECT;
    this.ownerIds = configService.get('OWNER_TELEGRAM_IDS', { infer: true });
  }

  async handle({ actor, input, dialog, locale }: BotContext): Promise<BotReply> {
    if (input.type === ChatInputType.TEXT && BROADCAST_TEXT_STEPS.includes(dialog?.step ?? '')) {
      return this.preview(locale, input.text);
    }
    if (input.type !== ChatInputType.BUTTON) {
      return { screen: { text: locale.bot.unknownInput } };
    }
    const button = BROADCAST_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR));
    if (!button.success) {
      return { screen: { text: locale.bot.expired } };
    }
    switch (button.data.action) {
      case BroadcastAction.START:
      case BroadcastAction.TEXT:
        return this.askText(locale);
      case BroadcastAction.SEND:
        return this.send(actor, locale, dialog);
      case BroadcastAction.CANCEL:
        return this.toMenuReply(locale, locale.broadcast.cancelled);
    }
  }

  private askText(locale: Locale, error?: string): BotReply {
    return {
      screen: {
        text: [
          ...(error ? [error, ''] : []),
          locale.broadcast.title,
          locale.broadcast.askText(BROADCAST_TEXT_MAX_LENGTH),
        ].join('\n'),
        buttons: [[this.toButton(locale.broadcast.cancel, BroadcastAction.CANCEL)]],
      },
      dialog: this.toDialog(BroadcastStep.TEXT, {}),
    };
  }

  private async preview(locale: Locale, raw: string): Promise<BotReply> {
    const text = raw.trim();
    if (text.length === 0 || text.length > BROADCAST_TEXT_MAX_LENGTH) {
      return this.askText(locale, locale.broadcast.textInvalid(BROADCAST_TEXT_MAX_LENGTH));
    }
    const recipients = (await this.userService.findRecipientChats(Channel.TELEGRAM)).length;
    const texts = locale.broadcast;
    return {
      screen: {
        text: [
          texts.preview,
          '',
          escapeMarkdown(text),
          '',
          recipients ? texts.recipients(recipients) : texts.noRecipients,
          texts.previewHint,
        ].join('\n'),
        buttons: [
          ...(recipients ? [[this.toButton(texts.send(recipients), BroadcastAction.SEND)]] : []),
          [
            this.toButton(texts.editText, BroadcastAction.TEXT),
            this.toButton(texts.cancel, BroadcastAction.CANCEL),
          ],
        ],
      },
      dialog: this.toDialog(BroadcastStep.PREVIEW, { text }),
    };
  }

  private async send(actor: BotActor, locale: Locale, dialog: BotDialog | null) {
    const draft = this.readDraft(dialog);
    if (!draft) {
      return { screen: { text: locale.bot.expired }, dialog: null };
    }
    const chatIds = await this.userService.findRecipientChats(Channel.TELEGRAM);
    const text = escapeMarkdown(draft.text);
    await this.deliveryTelegramQueueProducer.addBroadcast(
      randomUUID(),
      this.redirect
        ? this.ownerIds.map((chatId) => ({
            chatId,
            text: [locale.broadcast.redirected(chatIds.length), '', text].join('\n'),
          }))
        : chatIds.map((chatId) => ({ chatId, text })),
    );
    this.logger.log(
      { recipients: chatIds.length, redirected: this.redirect, actorId: actor.externalId },
      BroadcastSectionMessages.SENT,
    );
    return this.toMenuReply(
      locale,
      this.redirect
        ? locale.broadcast.sentRedirected(chatIds.length)
        : locale.broadcast.sent(chatIds.length),
    );
  }

  private readDraft(dialog: BotDialog | null) {
    if (
      dialog?.namespace !== BotNamespace.BROADCAST ||
      dialog.step !== String(BroadcastStep.PREVIEW)
    ) {
      return null;
    }
    const draft = BROADCAST_DRAFT_SCHEMA.safeParse(dialog.data);
    return draft.success ? draft.data : null;
  }

  private toMenuReply(locale: Locale, text: string): BotReply {
    return {
      screen: { text, buttons: [[{ text: locale.broadcast.menu, data: ADMIN_MENU_DATA }]] },
      dialog: null,
    };
  }

  private toDialog(step: BroadcastStep, data: Record<string, unknown>) {
    return { namespace: BotNamespace.BROADCAST, step, data };
  }

  private toButton(text: string, action: BroadcastAction) {
    return { text, data: [BotNamespace.BROADCAST, action].join(BOT_BUTTON_DATA_SEPARATOR) };
  }
}
