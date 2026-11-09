import type { BotCommand } from './bot.enums';
import type { Channel } from 'src/common/enums/channel.enums';
import type { Permission } from 'src/modules/application/user/user.enums';
import type { Language } from 'src/modules/application/i18n/i18n.enums';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import type { ChatInput, Screen } from 'src/common/interfaces/chat-channel.interface';
import type { User } from 'src/modules/application/user/user.interface';
import type { BotAccess } from './bot.enums';

export type BotSectionAccess = BotAccess | Permission;

export interface BotSectionOptions {
  access: BotSectionAccess;
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
}

export interface BotHandler {
  handle(context: BotContext): BotReply | Promise<BotReply>;
}

export interface BotRoute extends BotSectionOptions {
  handler: BotHandler;
}

export interface BotMenuItem {
  command: BotCommand;
  access: BotSectionAccess;
}
