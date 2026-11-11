import { Injectable } from '@nestjs/common';
import { ChatInputType } from 'src/common/channel/types/chat-input.enums';
import { AccessService } from '../access/access.service';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotCommand, BotNamespace } from '../types/bot.enums';
import type { BotContext, BotHandler, BotReply } from '../types/bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import {
  ADMIN_BROADCAST_DATA,
  ADMIN_BUTTON_SCHEMA,
  ADMIN_SECTIONS,
} from './constants/admin.constants';

@Injectable()
@BotSection({
  access: BotAccess.ADMIN,
  commands: [BotCommand.ADMIN],
  namespace: BotNamespace.ADMIN,
})
export class AdminHandler implements BotHandler {
  constructor(private readonly accessService: AccessService) {}

  handle({ actor, locale, input }: BotContext): BotReply {
    if (
      input.type === ChatInputType.BUTTON &&
      !ADMIN_BUTTON_SCHEMA.safeParse(input.data.split(BOT_BUTTON_DATA_SEPARATOR)).success
    ) {
      return { screen: { text: locale.bot.expired } };
    }

    const sections = [
      ...ADMIN_SECTIONS.filter(({ permission }) =>
        this.accessService.isAllowed(actor, permission),
      ).map(({ permission, data }) => ({ text: locale.permissions[permission], data })),
      ...(actor.isOwner ? [{ text: locale.admin.broadcast, data: ADMIN_BROADCAST_DATA }] : []),
    ];
    const lines = [locale.admin.title];
    if (sections.length === 0) {
      lines.push(locale.admin.noSections);
    }
    return {
      screen: { text: lines.join('\n'), buttons: sections.map((section) => [section]) },
      dialog: null,
    };
  }
}
