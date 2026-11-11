import { Channel } from 'src/common/channel/types/channel.enums';
import { BotCommand } from 'src/modules/application/bot/core/types/bot.enums';
import { Source } from 'src/modules/application/source/types/source.enums';
import {
  Gender,
  JobRole,
  Permission,
  UserStatus,
} from 'src/modules/application/user/types/user.enums';
import type { CommonLocale } from '../../types/i18n-common.interface';
import { Language } from '../../types/i18n.enums';

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
    [Permission.SETTINGS]: 'Settings',
    [Permission.TEMPLATES]: 'Templates',
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
    sections: {
      [BotCommand.REPORT]: 'Report',
      [BotCommand.SETTINGS]: 'Settings',
      [BotCommand.ADMIN]: 'Admin',
    },
  },
  cancel: {
    done: 'Cancelled.',
    nothing: 'Nothing to cancel.',
  },
  admin: {
    title: '**Management**',
    noSections: 'Nothing here for your permissions yet.',
    broadcast: 'Broadcast',
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
    schedule: {
      name: 'Scheduled report',
      description:
        'send the report on its own at your time on days with actions; `/report` always works',
    },
    ai: {
      name: 'AI',
      description: 'improve the wording of report lines with AI',
    },
    aiData: {
      name: 'Data in AI',
      description: 'send the titles of my commits and excerpts of my comments to AI',
    },
    channels: {
      name: 'Channels',
      description: 'where scheduled reports and broadcasts come; at least one stays on',
    },
    lastChannel: 'At least one channel has to get the reports. Turn another one on first.',
    on: 'yes',
    off: 'no',
    template: 'Report template',
  },
  templates: {
    title: '**Report template**',
    current: (name) => `Now: ${name}. Choose a template: Standard, a shared one or your own.`,
    standard: 'Standard',
    shared: (name) => `${name} (shared)`,
    mine: 'My templates',
    toSettings: '‹ Settings',
    chosen: (name) => `Done: your report will come in the template "${name}".`,
    notFound: 'Template not found: it may have been deleted.',
    mineTitle: (count) => `**My templates** · ${count}`,
    mineEmpty:
      'No templates of your own yet. Press "Create": the bot asks for a name and the text.',
    create: 'Create',
    back: '‹ Back',
    use: 'Use',
    delete: 'Delete',
    backToMine: '‹ My templates',
    confirmDelete: (name) =>
      `Delete the template **${name}**? If it is in use, the report goes back to Standard.`,
    confirm: 'Yes, delete',
    cancel: 'Cancel',
    deleted: (name) => `The template **${name}** is deleted.`,
    askName: (max) =>
      `What should the template be called? The name shows in the list, up to ${max} characters.`,
    nameInvalid: (max) => `The name must be 1 to ${max} characters long.`,
    askBody: (name, max) =>
      `**${name}**\nSend the template text in Liquid, up to ${max} characters. The report data is in \`context\`: projects \`context.projects\` (a project has \`name\` and lines \`items\`), a line has \`text\`, \`title\`, \`action\`, \`url\`. Example:\n\`{% for project in context.projects %}{{ project.name }}:\n{% for item in project.items %}• {{ item.text }}\n{% endfor %}{% endfor %}\`\nAll fields of the context are in the README, section "Your own templates".`,
    bodyInvalid: (max) => `The template text must be 1 to ${max} characters long.`,
    syntaxError: (error) => `The template has an error: ${error}. Fix it and send the text again.`,
    renderError: (error) =>
      `The template did not render on your data: ${error}. Fix it and send the text again.`,
    preview: (date) => `Preview on your report for ${date}:`,
    emptyOutput: '(the template printed nothing)',
    noPreview:
      'The template has no errors. There is no preview: you have no built report yet, `/report` gives one.',
    previewHint:
      'To fix it, send the corrected text or press "Edit text". The template is saved only by "Save".',
    save: 'Save',
    saved: (name) => `The template **${name}** is saved.`,
    cancelled: 'Creating the template is cancelled.',
    editText: 'Edit text',
    rename: 'Rename',
    askNewName: (name, max) => `A new name for **${name}**? Up to ${max} characters.`,
    renamed: (name) => `Done: the template is now called **${name}**.`,
    bodyReplaced: (name) =>
      `The text of **${name}** is replaced. The next report comes with the new text.`,
    editCancelled: 'The change is cancelled.',
    backToTemplate: '‹ To the template',
  },
  sharedTemplates: {
    title: (count) => `**Shared templates** · ${count}`,
    hint: 'Any employee can pick a shared template in /settings → "Report template".',
    empty:
      'No shared templates yet. Press "Create": the bot asks for a name and the text, and employees pick it in /settings.',
    create: 'Create',
    menu: 'Menu',
    usedBy: (count) => `Employees using it: ${count}`,
    backToList: '‹ Shared templates',
    confirmDelete: (name, count) =>
      `Delete the shared template **${name}**? Employees using it: ${count}; their reports go back to Standard.`,
    saved: (name) =>
      `The shared template **${name}** is saved. Employees pick it in /settings → "Report template".`,
  },
  broadcast: {
    title: '**Broadcast**',
    askText: (max) =>
      `Send the message for every active employee, up to ${max} characters. It goes to each of their channels. Formatting is not kept: plain text goes out.`,
    textInvalid: (max) => `The broadcast text must be 1 to ${max} characters long.`,
    preview: '**Broadcast preview**',
    recipients: (count) => `Recipients: ${count}.`,
    noRecipients: 'No recipients: no active employee has a reachable channel.',
    previewHint: 'To fix it, send a new text or press "Edit text".',
    send: (count) => `Send (${count})`,
    editText: 'Edit text',
    cancel: 'Cancel',
    sent: (count) => `The broadcast is going out. Recipients: ${count}.`,
    sentRedirected: (count) =>
      `Check mode: the broadcast went to the owners, not to the employees. Recipients would be: ${count}.`,
    redirected: (count) =>
      `↪ Broadcast: check mode \`DELIVERY_MODE=redirect\`, not sent to the employees. Recipients would be: ${count}.`,
    cancelled: 'Broadcast cancelled.',
    menu: '‹ Menu',
  },
  delivery: {
    redirected: (name) =>
      `↪ Report for **${name}**: check mode \`DELIVERY_MODE=redirect\`, not sent to the employee.`,
  },
  adminSettings: {
    title: '**Settings**',
    reportsOn: 'Scheduled reports: on.',
    pausedToday: 'Scheduled reports: paused for today.',
    pausedUntil: (date) => `Scheduled reports: paused through ${date}.`,
    pausedForever: 'Scheduled reports: paused with no end.',
    hint: 'During a pause the bot sends no scheduled reports to anyone. `/report` and "Report now" keep working.',
    pauseToday: 'Pause for today',
    pauseUntil: 'Pause until a day',
    pauseForever: 'Pause with no end',
    resume: 'Resume',
    chooseDay: (days) =>
      `Through which day should reports pause? Up to ${days} days ahead; for longer, use "Pause with no end".`,
    back: '‹ Back',
    menu: '‹ Menu',
    aiAlways:
      'AI always gets the action phrase, the title and the type of the task. Comments of others, task descriptions, emails and tokens never.',
    aiNotConfigured:
      'AI is not set up: it needs the variables `LLM_BASE_URL`, `LLM_TOKEN` and `LLM_MODEL`.',
    ai: {
      name: 'AI for everyone',
      description:
        'improve the wording of report lines; an employee can switch it off in /settings',
    },
    aiCommits: {
      name: 'Commits in AI',
      description: "send the titles of the employee's commits of the day",
    },
    aiComments: {
      name: 'Comments in AI',
      description: "send excerpts of up to 150 characters from the employee's comments of the day",
    },
    on: 'yes',
    off: 'no',
  },
};
