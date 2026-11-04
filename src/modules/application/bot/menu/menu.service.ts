import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Language } from 'src/modules/application/i18n/i18n.enums';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import type {
  ChatChannel,
  ChatCommand,
} from 'src/common/interfaces/chat-channel.interface';
import { getErrorMessage } from 'src/common/utils/error.util';
import { DEFAULT_LANGUAGE } from 'src/modules/application/i18n/constants/i18n.constants';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { AccessService } from '../access/access.service';
import { BOT_CHANNELS } from '../constants/bot.constants';
import { BotMessages } from '../constants/bot.messages';
import { BotAccess } from '../bot.enums';
import type { BotActor, BotMenuItem } from '../bot.interface';
import { RouterService } from '../router/router.service';

@Injectable()
export class MenuService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private readonly routerService: RouterService,
    private readonly accessService: AccessService,
    private readonly i18nService: I18nService,
    @Inject(BOT_CHANNELS) private readonly channels: ChatChannel[],
  ) {}

  onApplicationBootstrap() {
    void this.syncDefaults();
  }

  listCommands(actor: BotActor, locale: Locale) {
    return this.toCommands(
      this.routerService
        .listMenu()
        .filter(({ access }) => this.accessService.isAllowed(actor, access)),
      locale,
    );
  }

  async syncChat(actor: BotActor) {
    const commands = this.listCommands(
      actor,
      this.i18nService.getLocale(actor.language),
    );
    try {
      await this.channels
        .find((channel) => channel.channel === actor.channel)
        ?.setChatCommands(actor.chatId, commands);
    } catch (error) {
      this.logger.warn(
        `${BotMessages.MENU_SYNC_FAILED}: ${getErrorMessage(error)}`,
      );
    }
  }

  private async syncDefaults() {
    try {
      for (const channel of this.channels) {
        for (const language of Object.values(Language)) {
          await channel.setDefaultCommands(
            this.listPublicCommands(this.i18nService.getLocale(language)),
            language === DEFAULT_LANGUAGE ? null : language,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `${BotMessages.MENU_SYNC_FAILED}: ${getErrorMessage(error)}`,
      );
    }
  }

  private listPublicCommands(locale: Locale) {
    return this.toCommands(
      this.routerService
        .listMenu()
        .filter(({ access }) => access === BotAccess.ANYONE),
      locale,
    );
  }

  private toCommands(items: BotMenuItem[], locale: Locale): ChatCommand[] {
    return items.map(({ command }) => ({
      command,
      description: locale.commands[command],
    }));
  }
}
