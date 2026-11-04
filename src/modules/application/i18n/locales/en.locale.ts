import { Channel } from 'src/common/enums/channel.enums';
import { BotCommand } from 'src/modules/application/bot/bot.enums';
import type { Locale } from '../i18n.interface';

export const en: Locale = {
  channels: {
    [Channel.TELEGRAM]: 'Telegram',
    [Channel.SLACK]: 'Slack',
  },
  commands: {
    [BotCommand.START]: 'Start the bot',
    [BotCommand.HELP]: 'List of commands',
    [BotCommand.CANCEL]: 'Cancel the current action',
  },
  bot: {
    noAccess: (channel, id) =>
      `No access. Your ${channel} ID is \`${id}\`. Send it to your administrator.`,
    forbidden: 'You do not have permission for this action.',
    unknownCommand: 'Unknown command. See /help for the list of commands.',
    unknownInput:
      'I did not understand that. See /help for the list of commands.',
    expired: 'This button no longer works. Open the section again.',
    error: 'Something went wrong. Please try again a bit later.',
  },
  start: {
    owner: 'Hello! You are an owner of Report Daily and have all permissions.',
    employee: (name) =>
      `Hello, ${name}! Every working day I will send you a report on your work in GitLab.`,
  },
  help: {
    title: '**Commands**',
    privacy: 'Only you can see the text of your report.',
  },
  cancel: {
    done: 'Cancelled.',
    nothing: 'Nothing to cancel.',
  },
};
