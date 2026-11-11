import { Injectable } from '@nestjs/common';
import { BotCommand } from '../core/types/bot.enums';
import { BotSection } from '../core/bot.decorator';
import { BotAccess } from '../core/types/bot.enums';
import type { BotContext, BotHandler, BotReply } from '../core/types/bot.interface';
import { HELP_SECTIONS } from './constants/help.constants';
import { MenuService } from '../core/menu.service';

@Injectable()
@BotSection({ access: BotAccess.ANYONE, commands: [BotCommand.HELP] })
export class HelpHandler implements BotHandler {
  constructor(private readonly menuService: MenuService) {}

  handle({ actor, locale }: BotContext): BotReply {
    const allowed = this.menuService.listCommands(actor, locale);
    const lines = [
      locale.help.title,
      ...allowed.map(({ command, description }) => `/${command} — ${description}`),
    ];
    if (actor.user) {
      lines.push('', locale.help.privacy);
    }
    const buttons = HELP_SECTIONS.filter(({ command }) =>
      allowed.some((item) => item.command === String(command)),
    ).map(({ command, data }) => ({ text: locale.help.sections[command], data }));
    return {
      screen: { text: lines.join('\n'), ...(buttons.length ? { buttons: [buttons] } : {}) },
    };
  }
}
