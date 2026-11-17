import { ScreenButtonStyle } from 'src/common/channel/types/screen.enums';
import { SlackButtonStyle } from '../types/slack.enums';

export const SLACK_SPLIT_LIMIT = 2800;

export const SLACK_SECTION_TEXT_LIMIT = 3000;

export const SLACK_ACTIONS_LIMIT = 25;

export const SLACK_BUTTON_TEXT_LIMIT = 75;

export const SLACK_HEADER_TEXT_LIMIT = 150;

export const SLACK_EDGE_NEWLINES = /^\n+|\n+$/g;

export const SLACK_BUTTON_STYLES: Record<ScreenButtonStyle, SlackButtonStyle> = {
  [ScreenButtonStyle.PRIMARY]: SlackButtonStyle.PRIMARY,
  [ScreenButtonStyle.DANGER]: SlackButtonStyle.DANGER,
};

export const SLACK_ACTION_ID_PREFIX = 'button-';

export const SLACK_ACTION_ID_SEPARATOR = '-';

export const SLACK_USER_PICKER_ACTION = 'pick-user';
