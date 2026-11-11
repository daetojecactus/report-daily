import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Language } from 'src/modules/application/i18n/types/i18n.enums';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import type { ChatChannel, ChatCommand } from 'src/common/channel/types/chat-channel.interface';
import { getErrorMessage } from 'src/common/utils/error.util';
import { DEFAULT_LANGUAGE } from 'src/modules/application/i18n/constants/i18n.constants';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import type { Channel } from 'src/common/channel/types/channel.enums';
import type { UserChannel } from 'src/modules/application/user/channel/types/channel.interface';
import { ChannelService } from 'src/modules/application/user/channel/channel.service';
import type { User } from 'src/modules/application/user/types/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import { RedisService } from 'src/modules/infrastructure/redis/redis.service';
import { AccessService } from './access.service';
import { BOT_CHANNELS, BOT_MENU_SIGNATURE_KEY } from './constants/bot.constants';
import { BotMessages } from './constants/bot.messages';
import type { BotActor, BotMenuItem } from './types/bot.interface';
import { RouterService } from './router.service';

@Injectable()
export class MenuService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private readonly routerService: RouterService,
    private readonly accessService: AccessService,
    private readonly i18nService: I18nService,
    @Inject(BOT_CHANNELS) private readonly channels: ChatChannel[],
    private readonly userService: UserService,
    private readonly channelService: ChannelService,
    private readonly redisService: RedisService,
  ) {}

  onApplicationBootstrap() {
    void this.refresh();
  }

  listCommands(actor: BotActor, locale: Locale) {
    return this.toCommands(
      this.routerService
        .listMenu()
        .filter(({ access }) => this.accessService.isAllowed(actor, access)),
      locale,
    );
  }

  async syncEmployee(user: User | null, channels: UserChannel[]) {
    for (const channel of channels) {
      await (user
        ? this.syncChat(this.accessService.toActor(user, channel))
        : this.setCommands(channel.channel, channel.externalId, []));
    }
  }

  async syncChat(actor: BotActor) {
    await this.setCommands(
      actor.channel,
      actor.chatId,
      this.listCommands(actor, this.i18nService.getLocale(actor.language)),
    );
  }

  async refresh() {
    await this.syncDefaults();
    try {
      const signature = this.toSignature();
      if ((await this.redisService.get(BOT_MENU_SIGNATURE_KEY)) === signature) {
        return;
      }
      const [users, channels] = await Promise.all([
        this.userService.find(),
        this.channelService.find(),
      ]);
      const byId = new Map(users.map((user) => [user.id, user]));
      for (const channel of channels) {
        const user = byId.get(channel.userId);
        if (user) {
          await this.syncChat(this.accessService.toActor(user, channel));
        }
      }
      const owners = this.accessService
        .listOwners()
        .filter(
          (owner) =>
            !channels.some(
              (item) => item.channel === owner.channel && item.externalId === owner.externalId,
            ),
        );
      for (const owner of owners) {
        await this.syncChat(owner);
      }
      await this.redisService.set(BOT_MENU_SIGNATURE_KEY, signature);
      this.logger.log({ chats: channels.length + owners.length }, BotMessages.MENUS_REFRESHED);
    } catch (error) {
      this.logger.warn(`${BotMessages.MENU_SYNC_FAILED}: ${getErrorMessage(error)}`);
    }
  }

  private async setCommands(channel: Channel, chatId: string, commands: ChatCommand[]) {
    try {
      await this.channels
        .find((item) => item.channel === channel)
        ?.setChatCommands(chatId, commands);
    } catch (error) {
      this.logger.warn(`${BotMessages.MENU_SYNC_FAILED}: ${getErrorMessage(error)}`);
    }
  }

  private async syncDefaults() {
    try {
      for (const channel of this.channels) {
        for (const language of Object.values(Language)) {
          await channel.setDefaultCommands([], language === DEFAULT_LANGUAGE ? null : language);
        }
      }
    } catch (error) {
      this.logger.warn(`${BotMessages.MENU_SYNC_FAILED}: ${getErrorMessage(error)}`);
    }
  }

  private toSignature() {
    const languages = Object.values(Language);
    const menu = this.routerService.listMenu().map(({ command, access }) => ({
      command,
      access,
      descriptions: languages.map(
        (language) => this.i18nService.getLocale(language).commands[command],
      ),
    }));
    return createHash('sha256').update(JSON.stringify(menu)).digest('hex');
  }

  private toCommands(items: BotMenuItem[], locale: Locale): ChatCommand[] {
    return items.map(({ command }) => ({
      command,
      description: locale.commands[command],
    }));
  }
}
