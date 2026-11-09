import { Channel } from 'src/common/enums/channel.enums';
import { BotCommand } from 'src/modules/application/bot/bot.enums';
import { Source } from 'src/modules/application/source/source.enums';
import { Gender, JobRole, Permission, UserStatus } from 'src/modules/application/user/user.enums';
import type { CommonLocale } from '../../i18n.interface';
import { Language } from '../../i18n.enums';

export const enCommon: CommonLocale = {
  channels: {
    [Channel.TELEGRAM]: 'Telegram',
    [Channel.SLACK]: 'Slack',
  },
  sources: {
    [Source.GITLAB]: 'GitLab',
  },
  languages: {
    [Language.RU]: 'Русский',
    [Language.EN]: 'English',
  },
  commands: {
    [BotCommand.START]: 'Start the bot',
    [BotCommand.REPORT]: "Today's report",
    [BotCommand.SETTINGS]: 'My settings',
    [BotCommand.ADMIN]: 'Manage the bot',
    [BotCommand.HELP]: 'List of commands',
    [BotCommand.CANCEL]: 'Cancel the current action',
  },
  report: {
    choose: 'Which day should the report cover?',
    today: 'Today',
    yesterday: 'Yesterday',
    otherDay: 'Another day',
    chooseDay: (days) => `Choose a day, no more than ${days} days back.`,
    back: '‹ Back',
    todayText: 'today',
    yesterdayText: 'yesterday',
    building: (day) => `Building the report for ${day}. I'll send it as soon as it is ready.`,
    rebuilding: (day) =>
      `Rebuilding the report for ${day}. I'll send the new one as soon as it is ready.`,
    empty: (day) => `You have no actions in GitLab for ${day}, so there is no report.`,
    failed: 'Could not build the report: GitLab did not answer. Please try again later.',
    rebuild: 'Rebuild',
    wait: (seconds) => `You can rebuild once a minute. Try again in ${seconds} s.`,
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
    [Permission.TRAITS]: 'Traits',
    [Permission.BROADCAST]: 'Broadcast',
    [Permission.SETTINGS]: 'Settings',
  },
  bot: {
    noAccess: (channel, id) =>
      `No access. Your ${channel} ID is \`${id}\`. Send it to your administrator.`,
    forbidden: 'You do not have permission for this action.',
    unknownCommand: 'Unknown command. See /help for the list of commands.',
    unknownInput: 'I did not understand that. See /help for the list of commands.',
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
    chooseGender: 'Choose your gender: reports in Russian use it in the wording.',
    ai: {
      name: 'AI',
      description: 'improve the wording of report lines with AI',
    },
    aiData: {
      name: 'Data in AI',
      description: 'send the titles of my commits and excerpts of my comments to AI',
    },
    on: 'yes',
    off: 'no',
  },
};
