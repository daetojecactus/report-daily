import type { Channel } from './channel.enums';
import type { ChatInputType } from './chat-input.enums';

export interface ScreenButton {
  text: string;
  data: string;
}

export interface ScreenUserPicker {
  text: string;
}

export interface Screen {
  text: string;
  buttons?: ScreenButton[][];
  userPicker?: ScreenUserPicker;
}

export interface ChatCommand {
  command: string;
  description: string;
}

export type ChatInput =
  | { type: ChatInputType.COMMAND; command: string }
  | { type: ChatInputType.TEXT; text: string }
  | {
      type: ChatInputType.BUTTON;
      data: string;
      messageId: string;
      callbackId: string;
    }
  | { type: ChatInputType.PICKED_USER; externalId: string }
  | { type: ChatInputType.UNSUPPORTED };

export interface ChatEvent {
  channel: Channel;
  userId: string;
  chatId: string;
  languageCode: string | null;
  input: ChatInput;
}

export interface ChatChannel {
  readonly channel: Channel;
  isUserId(value: string): boolean;
  findLanguageCode(userId: string): Promise<string | null>;
  sendScreen(chatId: string, screen: Screen): Promise<string>;
  editScreen(chatId: string, messageId: string, screen: Screen): Promise<void>;
  answerButton(callbackId: string): Promise<void>;
  setDefaultCommands(commands: ChatCommand[], languageCode: string | null): Promise<void>;
  setChatCommands(chatId: string, commands: ChatCommand[]): Promise<void>;
}
