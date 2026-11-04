import { Injectable } from '@nestjs/common';
import { BotCommand } from '../bot.enums';
import { BotSection } from '../bot.decorator';
import { BotAccess } from '../bot.enums';
import type { BotContext, BotHandler, BotReply } from '../bot.interface';
import { MenuService } from '../menu/menu.service';

@Injectable()
@BotSection({ access: BotAccess.ANYONE, commands: [BotCommand.HELP] })
export class HelpHandler implements BotHandler {
  constructor(private readonly menuService: MenuService) {}

  handle({ actor, locale }: BotContext): BotReply {
    const commands = this.menuService
      .listCommands(actor, locale)
      .map(({ command, description }) => `/${command} — ${description}`);
    const lines = [locale.help.title, ...commands];
    if (actor.user) {
      lines.push('', locale.help.privacy);
    }
    return { screen: { text: lines.join('\n') } };
  }
}
