import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import type { ChatChannel } from 'src/common/channel/types/chat-channel.interface';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import type { UserChannel } from 'src/modules/application/user/channel/types/channel.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { DeliveryQueueProducer } from 'src/modules/queue/delivery/delivery-queue.producer';
import { ADMIN_MENU_DATA } from '../constants/admin.constants';
import { BotSection } from '../../core/bot.decorator';
import { DialogService } from '../../core/dialog.service';
import { BotAccess, BotNamespace } from '../../core/types/bot.enums';
import type {
  BotActor,
  BotContext,
  BotDialog,
  BotHandler,
  BotReply,
} from '../../core/types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR, BOT_CHANNELS } from '../../core/constants/bot.constants';
import { BroadcastAction, BroadcastStep } from './types/broadcast.enums';
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

  constructor(
    private readonly userService: UserService,
    private readonly deliveryQueueProducer: DeliveryQueueProducer,
    @Inject(BOT_CHANNELS) private readonly channels: ChatChannel[],
    private readonly dialogService: DialogService,
  ) {}

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
    const recipients = this.countPeople(await this.findRecipients());
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
    const recipients = await this.findRecipients();
    const people = this.countPeople(recipients);
    const text = escapeMarkdown(draft.text);
    const broadcastId = randomUUID();
    for (const { channel } of this.channels) {
      const messages = recipients
        .filter((recipient) => recipient.channel === channel)
        .map(({ externalId }) => ({ chatId: externalId, text }));
      if (messages.length > 0) {
        await this.deliveryQueueProducer.addBroadcast(channel, broadcastId, messages);
      }
    }
    this.logger.log(
      { recipients: people, actorId: actor.user?.id ?? BotAccess.OWNER },
      BroadcastSectionMessages.SENT,
    );
    return this.toMenuReply(locale, locale.broadcast.sent(people));
  }

  private findRecipients() {
    return this.userService.findRecipients(this.channels.map(({ channel }) => channel));
  }

  private countPeople(recipients: UserChannel[]) {
    return new Set(recipients.map(({ userId }) => userId)).size;
  }

  private readDraft(dialog: BotDialog | null) {
    return this.dialogService.readDraft(
      dialog,
      BotNamespace.BROADCAST,
      BROADCAST_DRAFT_SCHEMA,
      String(BroadcastStep.PREVIEW),
    );
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
