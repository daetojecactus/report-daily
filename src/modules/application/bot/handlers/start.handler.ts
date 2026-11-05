import { Injectable } from '@nestjs/common';
import { BotCommand } from '../bot.enums';
import { escapeMarkdown } from 'src/common/utils/markdown.util';
import { BotSection } from '../bot.decorator';
import { BotAccess } from '../bot.enums';
import type { BotContext, BotHandler, BotReply } from '../bot.interface';
import { MenuService } from '../menu/menu.service';

@Injectable()
@BotSection({ access: BotAccess.ANYONE, commands: [BotCommand.START] })
export class StartHandler implements BotHandler {
  constructor(private readonly menuService: MenuService) {}

  async handle({ actor, locale }: BotContext): Promise<BotReply> {
    if (actor.user) {
      await this.menuService.syncChat(actor);
      return {
        screen: {
          text: locale.start.employee(escapeMarkdown(actor.user.displayName)),
        },
      };
    }
    if (actor.isOwner) {
      await this.menuService.syncChat(actor);
      return { screen: { text: locale.start.owner } };
    }
    return {
      screen: {
        text: locale.bot.noAccess(locale.channels[actor.channel], actor.externalId),
      },
    };
  }
}
