export const SLACK_URL_TRAILING_SLASH = '/';

export const SLACK_RETRIES = 2;

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
