import { Channel } from 'src/common/enums/channel.enums';
import { BotCommand } from 'src/modules/application/bot/bot.enums';
import {
  Gender,
  JobRole,
  Permission,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import type { Locale } from '../i18n.interface';

export const en: Locale = {
  channels: {
    [Channel.TELEGRAM]: 'Telegram',
    [Channel.SLACK]: 'Slack',
  },
  commands: {
    [BotCommand.START]: 'Start the bot',
    [BotCommand.ADMIN]: 'Manage the bot',
    [BotCommand.HELP]: 'List of commands',
    [BotCommand.CANCEL]: 'Cancel the current action',
  },
  roles: {
    [JobRole.DEVELOPER]: 'Developer',
    [JobRole.QA]: 'QA',
    [JobRole.PROJECT_MANAGER]: 'Project manager',
    [JobRole.SYSTEM_ANALYST]: 'System analyst',
    [JobRole.DEVOPS]: 'DevOps',
  },
  genders: {
    [Gender.MALE]: 'male',
    [Gender.FEMALE]: 'female',
  },
  statuses: {
    [UserStatus.PENDING]: 'waiting for connection',
    [UserStatus.ACTIVE]: 'active',
    [UserStatus.ON_LEAVE]: 'on leave',
    [UserStatus.BLOCKED]: 'blocked',
  },
  permissions: {
    [Permission.USERS]: 'Employees',
    [Permission.LABELS]: 'Labels',
    [Permission.BROADCAST]: 'Broadcast',
    [Permission.SETTINGS]: 'Settings',
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
    owner:
      'Hello! You are an owner of Report Daily and have all permissions. Manage the bot with /admin.',
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
  admin: {
    title: '**Management**',
    noSections: 'Nothing here for your permissions yet.',
  },
  employees: {
    title: (count) => `**Employees** · ${count}`,
    page: (page, pages) => `Page ${page} of ${pages}`,
    empty: 'No employees yet.',
    previous: '‹ Back',
    next: 'Next ›',
    search: 'Search',
    menu: 'Menu',
    backToList: 'To the list',
    searchPrompt: 'Enter a name or a GitLab username.',
    searchTitle: (query) => `**Search:** ${query}`,
    searchEmpty: 'Nobody found.',
    searchTooMany: (limit) => `Showing the first ${limit}, refine the search.`,
    notFound: 'Employee not found: maybe they were deleted.',
    card: {
      gitlab: 'GitLab',
      role: 'Role',
      gender: 'Gender',
      status: 'Status',
      channels: 'Channels',
      permissions: 'Permissions',
      noChannels: 'not connected',
      reachable: 'connected',
      unreachable: 'unreachable, the bot is blocked',
    },
  },
};
