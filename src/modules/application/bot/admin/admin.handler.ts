import { Injectable } from '@nestjs/common';
import { ChatInputType } from 'src/common/enums/channel.enums';
import { AccessService } from '../access/access.service';
import { BotSection } from '../bot.decorator';
import { BotAccess, BotCommand, BotNamespace } from '../bot.enums';
import type { BotContext, BotHandler, BotReply } from '../bot.interface';
import { BOT_BUTTON_DATA_SEPARATOR } from '../constants/bot.constants';
import { ADMIN_BUTTON_SCHEMA, ADMIN_SECTIONS } from './constants/admin.constants';

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

    const sections = ADMIN_SECTIONS.filter(({ permission }) =>
      this.accessService.isAllowed(actor, permission),
    );
    const lines = [locale.admin.title];
    if (sections.length === 0) {
      lines.push(locale.admin.noSections);
    }
    return {
      screen: {
        text: lines.join('\n'),
        buttons: sections.map(({ permission, data }) => [
          { text: locale.permissions[permission], data },
        ]),
      },
      dialog: null,
    };
  }
}
