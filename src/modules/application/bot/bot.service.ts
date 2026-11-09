import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChatInputType, type Channel } from 'src/common/enums/channel.enums';
import { ChatUnreachableError } from 'src/common/errors/chat-unreachable.error';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import type {
  ChatChannel,
  ChatEvent,
  ChatInput,
  Screen,
} from 'src/common/interfaces/chat-channel.interface';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import { AccessService } from './access/access.service';
import { BOT_CHANNELS } from './constants/bot.constants';
import { BotMessages } from './constants/bot.messages';
import type { BotActor, BotDialog, BotRoute, BotTarget } from './bot.interface';
import { DialogService } from './dialog/dialog.service';
import { RouterService } from './router/router.service';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private readonly channels: Map<Channel, ChatChannel>;

  constructor(
    private readonly accessService: AccessService,
    private readonly routerService: RouterService,
    private readonly dialogService: DialogService,
    private readonly channelService: ChannelService,
    private readonly i18nService: I18nService,
    @Inject(BOT_CHANNELS) channels: ChatChannel[],
  ) {
    this.channels = new Map(channels.map((channel) => [channel.channel, channel]));
  }

  async handle(event: ChatEvent) {
    const actor = await this.accessService.resolveActor(event);
    const screen = await this.dispatch(
      actor,
      event.input,
      this.i18nService.getLocale(actor.language),
    );
    await this.reply(event, screen, actor);
  }

  async replyFailure(event: ChatEvent) {
    const channel = this.getChannel(event.channel);
    const locale = this.i18nService.getLocale(this.i18nService.resolveLanguage(event.languageCode));
    if (event.input.type === ChatInputType.BUTTON) {
      await channel.answerButton(event.input.callbackId);
    }
    await channel.sendScreen(event.chatId, { text: locale.bot.error });
  }

  async sendTo({ channel, chatId, externalId }: BotTarget, screen: Screen) {
    try {
      await this.getChannel(channel).sendScreen(chatId, screen);
    } catch (error) {
      if (!(error instanceof ChatUnreachableError)) {
        throw error;
      }
      await this.channelService.updateReachable(channel, externalId, false);
      this.logger.warn(`${BotMessages.CHANNEL_UNREACHABLE}: ${channel} ${externalId}`);
    }
  }

  private async dispatch(actor: BotActor, input: ChatInput, locale: Locale): Promise<Screen> {
    const isKnown = this.accessService.isKnown(actor);
    const dialog = isKnown ? await this.dialogService.find(actor) : null;
    const route = this.findRoute(input, dialog);
    if (!route) {
      return this.explain(actor, input, locale);
    }
    if (!this.accessService.isAllowed(actor, route.access)) {
      if (dialog) {
        await this.dialogService.delete(actor);
      }
      return {
        text: isKnown ? locale.bot.forbidden : this.denyText(actor, locale),
      };
    }
    if (dialog && input.type === ChatInputType.COMMAND) {
      await this.dialogService.delete(actor);
    }

    const reply = await route.handler.handle({ actor, locale, input, dialog });
    if (reply.dialog === null) {
      await this.dialogService.delete(actor);
    } else if (reply.dialog) {
      await this.dialogService.save(actor, reply.dialog);
    }
    return reply.screen;
  }

  private findRoute(input: ChatInput, dialog: BotDialog | null): BotRoute | null {
    switch (input.type) {
      case ChatInputType.COMMAND:
        return this.routerService.findByCommand(input.command);
      case ChatInputType.BUTTON:
        return this.routerService.findByButton(input.data);
      case ChatInputType.TEXT:
      case ChatInputType.PICKED_USER:
        return dialog ? this.routerService.findByNamespace(dialog.namespace) : null;
      default:
        return null;
    }
  }

  private explain(actor: BotActor, input: ChatInput, locale: Locale): Screen {
    if (!this.accessService.isKnown(actor)) {
      return { text: this.denyText(actor, locale) };
    }
    switch (input.type) {
      case ChatInputType.COMMAND:
        return { text: locale.bot.unknownCommand };
      case ChatInputType.BUTTON:
        return { text: locale.bot.expired };
      default:
        return { text: locale.bot.unknownInput };
    }
  }

  private denyText(actor: BotActor, locale: Locale) {
    return locale.bot.noAccess(locale.channels[actor.channel], actor.externalId);
  }

  private async reply(event: ChatEvent, screen: Screen, actor: BotActor) {
    const channel = this.getChannel(event.channel);
    try {
      if (event.input.type === ChatInputType.BUTTON) {
        await channel.answerButton(event.input.callbackId);
        await channel.editScreen(event.chatId, event.input.messageId, screen);
        return;
      }
      await channel.sendScreen(event.chatId, screen);
    } catch (error) {
      if (!(error instanceof ChatUnreachableError)) {
        throw error;
      }
      if (actor.user) {
        await this.channelService.updateReachable(event.channel, event.userId, false);
        this.logger.warn(`${BotMessages.CHANNEL_UNREACHABLE}: ${actor.user.id}`);
      }
    }
  }

  private getChannel(type: Channel) {
    const channel = this.channels.get(type);
    if (!channel) {
      throw new Error(`${BotMessages.CHANNEL_NOT_REGISTERED}: ${type}`);
    }
    return channel;
  }
}
