import { SLACK_COMMAND_WORDS } from './slack-events.constants';

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

export const SLACK_COMMAND_MENTION = new RegExp(
  `(^|[^\\w/.\\-\`])(\`?)/(${SLACK_COMMAND_WORDS.join('|')})(?![\\w-])(\`?)`,
  'g',
);

export const SLACK_CODE_MARK = '`';

export const SLACK_TITLE_START = '\uE000';

export const SLACK_TITLE_END = '\uE001';

export const SLACK_TITLE_PATTERN = /^\uE000([^\uE000\uE001]+)\uE001((?: · [^\uE000\uE001]+)?)$/;
