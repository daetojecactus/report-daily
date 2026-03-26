import {
  BotCommand,
  UserCallbackAction,
} from 'src/modules/application/bot-command/bot-command.types';

export const USER_COMMANDS = new Set<string>([
  BotCommand.INFO,
  BotCommand.SEND_REPORT,
  BotCommand.TOGGLE_AI,
  BotCommand.CHANGE_REPORT_HOUR,
  BotCommand.LANGUAGE,
]);

export const USER_CALLBACK_PREFIXES: string[] =
  Object.values(UserCallbackAction);
