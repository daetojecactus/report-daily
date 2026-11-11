import type { BotCommand } from './bot.enums';
import type { Channel } from 'src/common/channel/types/channel.enums';
import type { Language } from 'src/modules/application/i18n/types/i18n.enums';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import type { ChatInput, Screen } from 'src/common/channel/types/chat-channel.interface';
import type { User } from 'src/modules/application/user/types/user.interface';
import type { BotAccess } from './bot.enums';

export interface BotSectionOptions {
  access: BotAccess;
  commands?: BotCommand[];
  namespace?: string;
}

export interface BotTarget {
  channel: Channel;
  chatId: string;
  externalId: string;
}

export interface BotActor {
  channel: Channel;
  externalId: string;
  chatId: string;
  language: Language;
  isOwner: boolean;
  user: User | null;
}

export interface BotDialog {
  namespace: string;
  step: string;
  data: Record<string, unknown>;
}

export interface BotContext {
  actor: BotActor;
  locale: Locale;
  input: ChatInput;
  dialog: BotDialog | null;
}

export interface BotReply {
  screen: Screen;
  dialog?: BotDialog | null;
  newMessage?: boolean;
}

export interface BotHandler {
  handle(context: BotContext): BotReply | Promise<BotReply>;
}

export interface BotRoute extends BotSectionOptions {
  handler: BotHandler;
}

export interface BotMenuItem {
  command: BotCommand;
  access: BotAccess;
}
