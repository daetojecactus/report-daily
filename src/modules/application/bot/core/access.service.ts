import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel } from 'src/common/channel/types/channel.enums';
import { UserStatus } from 'src/modules/application/user/types/user.enums';
import type { ChatEvent } from 'src/common/channel/types/chat-channel.interface';
import { I18nService } from 'src/modules/application/i18n/i18n.service';
import { DEFAULT_LANGUAGE } from 'src/modules/application/i18n/constants/i18n.constants';
import type { UserChannel } from 'src/modules/application/user/channel/types/channel.interface';
import type { User } from 'src/modules/application/user/types/user.interface';
import { UserService } from 'src/modules/application/user/user.service';
import type { AppEnvs } from 'src/modules/infrastructure/config/config.env';
import { BotAccess } from './types/bot.enums';
import type { BotActor } from './types/bot.interface';

@Injectable()
export class AccessService {
  private readonly owners: Record<Channel, string[]>;

  constructor(
    configService: ConfigService<AppEnvs, true>,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {
    this.owners = {
      [Channel.TELEGRAM]: configService.get('OWNER_TELEGRAM_IDS', { infer: true }) ?? [],
      [Channel.SLACK]: configService.get('OWNER_SLACK_IDS', { infer: true }) ?? [],
    };
  }

  async resolveActor(
    event: ChatEvent,
    findLanguageCode: () => Promise<string | null> = () => Promise.resolve(null),
  ): Promise<BotActor | null> {
    const found = await this.userService.findOneByChannel(event.channel, event.userId);
    const isOwner = this.owners[event.channel].includes(event.userId);
    if (!found && !isOwner) {
      return null;
    }
    const language =
      found?.user.language ??
      this.i18nService.resolveLanguage(event.languageCode ?? (await findLanguageCode()));
    const isActive = found !== null && found.user.status !== UserStatus.BLOCKED;
    if (isActive) {
      await this.userService.recordContact(found, language);
    }

    return {
      channel: event.channel,
      externalId: event.userId,
      chatId: event.chatId,
      language,
      isOwner,
      user: isActive ? found.user : null,
    };
  }

  toActor(user: User | null, channel: UserChannel): BotActor {
    return {
      channel: channel.channel,
      externalId: channel.externalId,
      chatId: channel.externalId,
      language: user?.language ?? DEFAULT_LANGUAGE,
      isOwner: this.owners[channel.channel].includes(channel.externalId),
      user: user && user.status !== UserStatus.BLOCKED ? user : null,
    };
  }

  listOwners(): BotActor[] {
    return Object.values(Channel).flatMap((channel) =>
      this.owners[channel].map((externalId) => ({
        channel,
        externalId,
        chatId: externalId,
        language: DEFAULT_LANGUAGE,
        isOwner: true,
        user: null,
      })),
    );
  }

  isKnown(actor: BotActor) {
    return actor.isOwner || actor.user !== null;
  }

  canManage(actor: BotActor, target: User) {
    return actor.isOwner && actor.user?.id !== target.id;
  }

  isAllowed(actor: BotActor, access: BotAccess) {
    switch (access) {
      case BotAccess.ANYONE:
        return true;
      case BotAccess.EMPLOYEE:
        return actor.user !== null;
      case BotAccess.ADMIN:
        return actor.isOwner || (actor.user?.isAdmin ?? false);
      case BotAccess.OWNER:
        return actor.isOwner;
    }
  }
}
