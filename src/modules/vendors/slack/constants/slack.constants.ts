export const SLACK_SPLIT_LIMIT = 2800;

export const SLACK_ACTIONS_LIMIT = 25;

export const SLACK_BUTTON_TEXT_LIMIT = 75;

export const SLACK_CUT_MARK = '…';

export const SLACK_ACTION_ID_PREFIX = 'button-';

export const SLACK_ACTION_ID_SEPARATOR = '-';

export const SLACK_USER_PICKER_ACTION = 'pick-user';

export const SLACK_RETRIES = 2;

export const SLACK_SPECIAL_CHARACTERS = /[&<>]/g;

export const SLACK_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

export const SLACK_UNREACHABLE_ERRORS = [
  'channel_not_found',
  'user_not_found',
  'user_disabled',
  'account_inactive',
  'cannot_dm_bot',
  'is_archived',
  'not_in_channel',
];

export const SLACK_MESSAGE_GONE_ERRORS = [
  'message_not_found',
  'cant_update_message',
  'edit_window_closed',
];
