export enum SlackBlockType {
  SECTION = 'section',
  ACTIONS = 'actions',
}

export enum SlackElementType {
  BUTTON = 'button',
  USERS_SELECT = 'users_select',
}

export enum SlackEnvelopeType {
  EVENTS_API = 'events_api',
  INTERACTIVE = 'interactive',
  SLASH_COMMANDS = 'slash_commands',
}

export enum SlackTextType {
  PLAIN = 'plain_text',
  MRKDWN = 'mrkdwn',
}
