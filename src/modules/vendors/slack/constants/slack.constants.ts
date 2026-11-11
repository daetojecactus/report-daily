import { z } from 'zod';
import { SlackElementType, SlackEnvelopeType } from '../types/slack.enums';

export const SLACK_SPLIT_LIMIT = 2800;

export const SLACK_SECTION_TEXT_LIMIT = 3000;

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

export const SLACK_ESCAPED_CHARACTERS = /&(?:amp|lt|gt);/g;

export const SLACK_UNESCAPES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
};

export const SLACK_MARKUP = /<([^<>|]+)(?:\|([^<>]*))?>/g;

export const SLACK_USER_MARK = '@';

export const SLACK_CHANNEL_MARK = '#';

export const SLACK_SPECIAL_MARK = '!';

export const SLACK_URL_SCHEME = /^[a-z][a-z\d+.-]*:(?:\/\/)?/i;

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

export const SLACK_SOCKET_EVENT = 'slack_event';

export const SLACK_COMMAND_WORDS = ['start', 'report', 'settings', 'admin', 'help', 'cancel'];

export const SLACK_SLASH_COMMAND = '/report-daily';

export const SLACK_COMMAND_MENTION = new RegExp(
  `(^|[^\\w/.-])/(${SLACK_COMMAND_WORDS.join('|')})(?![\\w-])`,
  'g',
);

export const SLACK_DEFAULT_COMMAND = 'help';

export const SLACK_COMMAND_PREFIX = '/';

export const SLACK_WORD_SEPARATOR = /\s+/;

export const SLACK_ENVELOPE_TYPE_SCHEMA = z.enum(SlackEnvelopeType);

export const SLACK_SLASH_COMMAND_SCHEMA = z.object({
  user_id: z.string().min(1),
  text: z.string().default(''),
});

export const SLACK_MESSAGE_EVENT_SCHEMA = z.object({
  event_id: z.string().optional(),
  event: z.object({
    type: z.literal('message'),
    channel_type: z.literal('im'),
    channel: z.string().min(1),
    user: z.string().min(1),
    text: z.string().default(''),
    bot_id: z.string().optional(),
    subtype: z.string().optional(),
  }),
});

export const SLACK_BLOCK_ACTIONS_SCHEMA = z.object({
  type: z.literal('block_actions'),
  user: z.object({ id: z.string().min(1) }),
  channel: z.object({ id: z.string().min(1) }),
  message: z.object({ ts: z.string().min(1) }),
  actions: z
    .array(
      z.union([
        z.object({ type: z.literal(SlackElementType.BUTTON), value: z.string() }),
        z.object({ type: z.literal(SlackElementType.USERS_SELECT), selected_user: z.string() }),
      ]),
    )
    .min(1),
});
