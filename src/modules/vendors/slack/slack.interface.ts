import type { SlackBlockType, SlackElementType, SlackTextType } from './slack.enums';

export interface SlackText {
  type: SlackTextType;
  text: string;
  emoji?: boolean;
}

export interface SlackSectionBlock {
  type: SlackBlockType.SECTION;
  text: SlackText;
}

export interface SlackButton {
  type: SlackElementType.BUTTON;
  text: SlackText;
  action_id: string;
  value: string;
}

export interface SlackUsersSelect {
  type: SlackElementType.USERS_SELECT;
  action_id: string;
  placeholder: SlackText;
}

export interface SlackActionsBlock {
  type: SlackBlockType.ACTIONS;
  elements: (SlackButton | SlackUsersSelect)[];
}

export type SlackBlock = SlackSectionBlock | SlackActionsBlock;

export interface SlackMessageContent {
  text: string;
  blocks: SlackBlock[];
}

export interface SlackPostedMessage {
  channel: string;
  ts: string;
}
