import { Injectable } from '@nestjs/common';
import { BotCommand } from '../types/bot.enums';
import { BotSection } from '../bot.decorator';
import { BotAccess } from '../types/bot.enums';
import type { BotContext, BotHandler, BotReply } from '../types/bot.interface';

@Injectable()
@BotSection({ access: BotAccess.ANYONE, commands: [BotCommand.CANCEL] })
export class CancelHandler implements BotHandler {
  handle({ dialog, locale }: BotContext): BotReply {
    return {
      screen: { text: dialog ? locale.cancel.done : locale.cancel.nothing },
      dialog: null,
    };
  }
}
