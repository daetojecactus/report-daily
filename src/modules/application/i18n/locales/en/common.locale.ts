import { Channel } from 'src/common/channel/types/channel.enums';
import { BotCommand } from 'src/modules/application/bot/core/types/bot.enums';
import { Source } from 'src/modules/application/source/types/source.enums';
import { Gender, JobRole, UserStatus } from 'src/modules/application/user/types/user.enums';
import { AdminSection } from 'src/modules/application/bot/admin/types/admin.enums';
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
    back: 'Back',
    todayText: 'today',
    yesterdayText: 'yesterday',
    building: (day) => `Building the report for ${day}. I'll send it as soon as it is ready.`,
    rebuilding: (day) =>
      `Rebuilding the report for ${day}. I'll send the new one as soon as it is ready.`,
    inProgress: (day) =>
      `The report for ${day} is already being built. I'll send it as soon as it is ready.`,
    empty: (day) =>
      `No actions in GitLab for ${day}. If you did work, make your GitLab profile public: the bot cannot see a private one.`,
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
  rolesShort: {
    [JobRole.DEVELOPER]: 'Developer',
    [JobRole.QA]: 'QA',
    [JobRole.PROJECT_MANAGER]: 'Manager',
    [JobRole.SYSTEM_ANALYST]: 'Analyst',
    [JobRole.DEVOPS]: 'DevOps',
  },
  genders: {
    [Gender.MALE]: 'male',
    [Gender.FEMALE]: 'female',
  },
  statuses: {
    [UserStatus.PENDING]: 'waiting for a channel',
    [UserStatus.ACTIVE]: 'active',
    [UserStatus.BLOCKED]: 'blocked',
  },
  statusesShort: {
    [UserStatus.ACTIVE]: 'active',
    [UserStatus.PENDING]: 'no channel',
    [UserStatus.BLOCKED]: 'blocked',
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
      `Hello, ${name}! On days with actions in GitLab I will send a report on your work at your time. Settings: /settings.`,
  },
  help: {
    title: '**Commands**',
    privacy: 'Only you can see the text of your report.',
    sections: {
      [BotCommand.REPORT]: 'Report',
      [BotCommand.SETTINGS]: 'Settings',
      [BotCommand.ADMIN]: 'Management',
    },
  },
  cancel: {
    done: 'Cancelled.',
    nothing: 'Nothing to cancel.',
  },
  admin: {
    title: '**Management**',
    noSections: 'Nothing here for your access level yet.',
    employees: (total, active) => `Employees: ${total}, ${active} active`,
    sections: {
      [AdminSection.EMPLOYEES]: 'Employees',
      [AdminSection.TRAITS]: 'Traits',
      [AdminSection.SHARED_TEMPLATES]: 'Shared templates',
      [AdminSection.SETTINGS]: 'Settings',
      [AdminSection.BROADCAST]: 'Broadcast',
    },
  },
  settings: {
    title: '**Settings**',
    general: 'General',
    reports: 'Reports and AI',
    reportsWithoutAi: 'Reports',
    channels: 'Delivery channels',
    channelDescription: 'Scheduled reports and broadcasts. At least one channel stays on.',
    language: 'Language',
    reportTime: 'Report time',
    timeZone: 'Time zone',
    defaultTimeZone: (zone) => `${zone}, default`,
    useDefault: (zone) => `Default: ${zone}`,
    back: 'Back',
    chooseLanguage: 'Choose the language of the bot and reports.',
    chooseHour: (zone) => `Choose the report hour. Time zone: ${zone}.`,
    chooseMinute: 'Choose the minutes.',
    timeZonePrompt: (zone) =>
      `Send the time zone as an IANA name, for example \`Europe/Moscow\`.\nNow: ${zone}`,
    timeZoneInvalid: 'Unknown time zone. Example: `Europe/Moscow`.',
    gender: 'Gender',
    chooseGender: 'Choose your gender. Reports in Russian use it in the wording.',
    schedule: {
      name: 'Scheduled report',
      description: 'The report comes at your time on days with actions. `/report` always works.',
    },
    ai: {
      name: 'AI',
      description: 'AI improves the wording of report lines.',
    },
    aiData: {
      name: 'Data in AI',
      description: 'AI gets the titles of your commits and excerpts of your comments.',
    },
    lastChannel: 'At least one channel has to get the reports. Turn another one on first.',
    on: 'yes',
    off: 'no',
    now: (state) => `Now: ${state}`,
    turnOn: 'Turn on',
    turnOff: 'Turn off',
    template: 'Report template',
  },
  templates: {
    title: '**Report template**',
    current: (name) => `Current: ${name}`,
    standard: 'Standard',
    shared: (name) => `${name} (shared)`,
    mine: 'My templates',
    chosen: (name) => `Done: your report will use the template "${name}".`,
    notFound: 'Template not found: it may have been deleted.',
    mineTitle: (count) => `**My templates** · ${count}`,
    mineEmpty:
      'No templates of your own yet. Press "Create": the bot asks for a name and the text.',
    create: 'Create',
    back: 'Back',
    use: 'Use',
    delete: 'Delete',
    backToMine: 'My templates',
    selected: (name) => `${name} (selected)`,
    confirmDelete: (name) =>
      `Delete the template **${name}**? If it is in use, the report goes back to Standard.`,
    makeShared: 'Make shared',
    confirmShare: (name) =>
      `Make the template **${name}** shared? Any employee can pick it, and admins edit it.`,
    confirmMakeShared: 'Yes, make shared',
    madeShared: (name) => `The template **${name}** is shared now and is in "Shared templates".`,
    confirm: 'Yes, delete',
    cancel: 'Cancel',
    deleted: (name) => `The template **${name}** is deleted.`,
    askName: (max) =>
      `What should the template be called? The name shows in the list, up to ${max} characters.`,
    nameInvalid: (max) => `The name must be 1 to ${max} characters long.`,
    askBody: (name, max) =>
      `**${name}**\nSend the template text in Liquid, up to ${max} characters.\nProjects: \`context.projects\`, a project has \`name\` and lines \`items\`.\nLine: \`text\`, \`title\`, \`action\`, \`url\`.\nExample:\n\`{% for project in context.projects %}{{ project.name }}:\n{% for item in project.items %}• {{ item.text }}\n{% endfor %}{% endfor %}\`\nAll fields: README, section "Report templates".`,
    bodyInvalid: (max) => `The template text must be 1 to ${max} characters long.`,
    syntaxError: (error) => `The template has an error: ${error}. Fix it and send the text again.`,
    renderError: (error) =>
      `The template did not render on your data: ${error}. Fix it and send the text again.`,
    preview: (date) => `Preview on your report for ${date}:`,
    emptyOutput: '(the template printed nothing)',
    noPreview:
      'The template has no errors. There is no preview: you have no built report yet; run `/report` to get one.',
    previewHint: 'To fix it, send the new text. The template is saved after "Save".',
    save: 'Save',
    saved: (name) => `The template **${name}** is saved.`,
    cancelled: 'Creating the template is cancelled.',
    editText: 'Edit text',
    rename: 'Rename',
    askNewName: (name, max) => `A new name for **${name}**? Up to ${max} characters.`,
    renamed: (name) => `Done: the template is now called **${name}**.`,
    bodyReplaced: (name) => `The text of **${name}** is updated.`,
    editCancelled: 'The change is cancelled.',
    backToTemplate: 'To the template',
  },
  sharedTemplates: {
    title: (count) => `**Shared templates** · ${count}`,
    hint: 'Employees pick them in /settings, section "Report template".',
    empty: 'No shared templates yet. Create the first one: employees pick it in /settings.',
    create: 'Create',
    menu: 'Menu',
    usedBy: (count) => `Employees using it: ${count}`,
    backToList: 'Shared templates',
    confirmDelete: (name, count) =>
      `Delete the shared template **${name}**? Employees using it: ${count}; their reports go back to Standard.`,
    saved: (name) => `The shared template **${name}** is saved.`,
  },
  broadcast: {
    title: '**Broadcast**',
    askText: (max) =>
      `Send the text, up to ${max} characters.\nRecipients: every active employee, in all their channels.`,
    textInvalid: (max) => `The broadcast text must be 1 to ${max} characters long.`,
    preview: '**Broadcast preview**',
    recipients: (count) => `Recipients: ${count}`,
    noRecipients: 'No recipients: no active employee has a reachable channel.',
    previewHint: 'To fix it, send a new text.',
    send: (count) => `Send (${count})`,
    editText: 'Edit text',
    cancel: 'Cancel',
    sent: (count) => `The broadcast is going out. Recipients: ${count}.`,
    cancelled: 'Broadcast cancelled.',
    menu: 'Menu',
  },
  adminSettings: {
    title: '**Settings**',
    reports: 'Scheduled reports',
    reportsOn: 'on',
    pausedToday: 'paused for today',
    pausedUntil: (date) => `paused through ${date}`,
    pausedForever: 'paused with no end',
    pause: 'Pause of reports',
    pauseHint:
      'During a pause nobody gets scheduled reports. `/report` and "Report now" keep working.',
    pauseToday: 'For today',
    pauseUntil: 'Until a day',
    pauseForever: 'No end',
    resume: 'Resume',
    confirmToday: 'Nobody gets a scheduled report today.',
    confirmForever: 'Scheduled reports stop until the pause is lifted.',
    confirmResume: 'Scheduled reports come again.',
    setPause: 'Pause',
    chooseDay: (days) => `Through which day should reports pause? Up to ${days} days ahead.`,
    back: 'Back',
    menu: 'Menu',
    aiNotConfigured: 'AI: not set up',
    ai: {
      name: 'AI for everyone',
      description:
        'AI improves the wording of report lines; an employee can switch it off. Comments of others, task descriptions, emails and tokens never go to AI.',
    },
    aiCommits: {
      name: 'Commits in AI',
      description: "AI gets the titles of the employee's commits of the day.",
    },
    aiComments: {
      name: 'Comments in AI',
      description:
        "AI gets excerpts of up to 150 characters from the employee's comments of the day.",
    },
    on: 'yes',
    off: 'no',
    now: (state) => `Now: ${state}`,
    turnOn: 'Turn on',
    turnOff: 'Turn off',
  },
};
