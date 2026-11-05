import { Channel } from 'src/common/enums/channel.enums';
import { BotCommand } from 'src/modules/application/bot/bot.enums';
import {
  Gender,
  JobRole,
  Permission,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import { Language } from '../i18n.enums';
import type { Locale } from '../i18n.interface';

export const en: Locale = {
  channels: {
    [Channel.TELEGRAM]: 'Telegram',
    [Channel.SLACK]: 'Slack',
  },
  languages: {
    [Language.RU]: 'Русский',
    [Language.EN]: 'English',
  },
  commands: {
    [BotCommand.START]: 'Start the bot',
    [BotCommand.SETTINGS]: 'My settings',
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
  settings: {
    title: '**My settings**',
    language: 'Language',
    reportTime: 'Report time',
    timeZone: 'Time zone',
    defaultTimeZone: (zone) => `${zone}, default`,
    useDefault: (zone) => `Default: ${zone}`,
    back: 'Back',
    chooseLanguage: 'Choose the language of the bot and reports.',
    chooseHour: (zone) => `Choose the report hour in the ${zone} time zone.`,
    chooseMinute: 'Choose the minutes.',
    timeZonePrompt: (zone) =>
      `Send the time zone as an IANA name, for example \`Europe/Moscow\` or \`Asia/Almaty\`. Now: ${zone}.`,
    timeZoneInvalid: 'Unknown time zone. Example: `Europe/Moscow`.',
    gender: 'Gender',
    chooseGender:
      'Choose your gender: reports in Russian use it in the wording.',
    ai: {
      name: 'AI',
      description: 'improve the wording of report lines with AI',
    },
    aiData: {
      name: 'Data in AI',
      description:
        'send the titles of my commits and excerpts of my comments to AI',
    },
    on: 'yes',
    off: 'no',
  },
  employees: {
    title: (count) => `**Employees** · ${count}`,
    page: (page, pages) => `Page ${page} of ${pages}`,
    empty: 'No employees yet.',
    previous: '‹ Back',
    next: 'Next ›',
    search: 'Search',
    add: 'Add',
    bind: (channel) => `Bind ${channel}`,
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
  employeeAdd: {
    prompt: "Enter the employee's name or username in GitLab.",
    gitlabUnavailable:
      'GitLab is unavailable right now. Try again a bit later: just send the query again.',
    noMatches: 'Nobody found in GitLab. Try another name or username.',
    pick: (query) => `**GitLab:** ${query}\nChoose the employee.`,
    role: (name) => `**${name}**\nChoose the role.`,
    gender: (name) => `**${name}**\nChoose the gender.`,
    alreadyAdded: (name) => `**${name}** is already an employee.`,
    added: (name) => `Employee added: **${name}**.`,
    activityHidden:
      'GitLab shows no events of this employee: the profile is private or there was no activity yet. If the profile is private, ask to make it public.',
    activityUnknown: "Could not check the employee's activity in GitLab.",
    pending: 'No channel is bound yet, so reports are not sent.',
    openCard: 'Open the card',
    cancel: 'Cancel',
    cancelled: 'Adding cancelled.',
  },
  employeeManage: {
    changeRole: 'Change role',
    block: 'Block',
    unblock: 'Unblock',
    delete: 'Delete',
    confirm: 'Yes, delete',
    cancel: 'Cancel',
    chooseRole: (name, role) =>
      `**${name}**\nNow: ${role}. Choose the new role.`,
    roleChanged: (name, role) => `Role changed: **${name}** — ${role}.`,
    blocked: (name) =>
      `Employee blocked: **${name}**. The bot no longer answers them or sends reports.`,
    unblocked: (name) => `Employee unblocked: **${name}**.`,
    confirmDelete: (name) =>
      `Delete the employee **${name}**? Their channels and reports are deleted with them.`,
    deleted: (name) => `Employee deleted: **${name}**.`,
    self: 'You cannot block or delete yourself.',
    ownerOnly:
      'Only an owner can block or delete an employee with permissions.',
  },
  employeePermissions: {
    open: 'Permissions',
    title: (name) =>
      `**${name}**\nPermissions in the bot. Tap one to grant or revoke it.`,
    descriptions: {
      [Permission.USERS]: 'add, change, block and delete employees',
      [Permission.LABELS]: 'set up GitLab labels',
      [Permission.BROADCAST]: 'send a broadcast to all employees',
      [Permission.SETTINGS]: 'report pause, AI, calendar, system status',
    },
    granted: 'yes',
    revoked: 'no',
  },
  employeeBind: {
    prompt: (channel, name) =>
      `**${name}**\nChoose the employee in ${channel} or enter their ${channel} ID. The bot shows the ID to a person who writes to it without access.`,
    pick: (channel) => `Choose in ${channel}`,
    pickPrompt:
      'Press "Choose the employee" at the bottom of the screen and pick them from your chats or contacts. Cancel with /cancel.',
    pickButton: 'Choose the employee',
    invalid: (channel) =>
      `This does not look like a ${channel} ID. Enter the number the bot showed the employee.`,
    taken: (name) =>
      `This account is already bound to **${name}**. Enter another ID.`,
    alreadyBound: (channel) => `The employee already has ${channel} bound.`,
    bound: (channel, name) => `${channel} bound: **${name}**.`,
    hint: 'If the employee has not written to the bot yet, ask them to open it and press Start.',
    cancel: 'Cancel',
    cancelled: 'Binding cancelled.',
  },
};
