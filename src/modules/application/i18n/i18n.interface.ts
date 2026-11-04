import type { Channel } from 'src/common/enums/channel.enums';
import type { BotCommand } from 'src/modules/application/bot/bot.enums';

export interface Locale {
  channels: Record<Channel, string>;
  commands: Record<BotCommand, string>;
  bot: {
    noAccess: (channel: string, id: string) => string;
    forbidden: string;
    unknownCommand: string;
    unknownInput: string;
    expired: string;
    error: string;
  };
  start: {
    owner: string;
    employee: (name: string) => string;
  };
  help: {
    title: string;
    privacy: string;
  };
  cancel: {
    done: string;
    nothing: string;
  };
}
