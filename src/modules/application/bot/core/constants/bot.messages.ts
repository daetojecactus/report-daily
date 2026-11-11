export enum BotMessages {
  DUPLICATE_COMMAND = 'Bot command is handled by two sections',
  DUPLICATE_NAMESPACE = 'Bot namespace is used by two sections',
  CHANNEL_NOT_REGISTERED = 'Chat channel is not registered',
  CHANNEL_UNREACHABLE = 'Chat channel is unreachable',
  MENU_SYNC_FAILED = 'Bot command menu sync failed',
  LANGUAGE_FAILED = 'Language of the failed event is unknown, the channel language is used',
  STRANGER_IGNORED = 'Message from a person who is not an employee ignored',
  MENUS_REFRESHED = 'Chat menus refreshed after the commands changed',
}
