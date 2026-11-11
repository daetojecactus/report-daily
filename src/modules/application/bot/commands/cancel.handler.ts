import { Injectable } from '@nestjs/common';
import { BotCommand } from '../core/types/bot.enums';
import { BotSection } from '../core/bot.decorator';
import { BotAccess } from '../core/types/bot.enums';
import type { BotContext, BotHandler, BotReply } from '../core/types/bot.interface';

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
