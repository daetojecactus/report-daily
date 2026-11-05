import { Channel } from 'src/common/enums/channel.enums';
import { BotCommand } from 'src/modules/application/bot/bot.enums';
import {
  TraitDimension,
  Priority,
  Severity,
  TaskArea,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import {
  Gender,
  JobRole,
  Permission,
  UserStatus,
} from 'src/modules/application/user/user.enums';
import { Source } from 'src/modules/application/source/source.enums';
import { Language } from '../i18n.enums';
import type { Locale } from '../i18n.interface';

export const en: Locale = {
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
    [Permission.TRAITS]: 'Traits',
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
  traits: {
    dimensions: {
      [TraitDimension.WORKFLOW_STATE]: 'State',
      [TraitDimension.TASK_KIND]: 'Task type',
      [TraitDimension.PRIORITY]: 'Priority',
      [TraitDimension.SEVERITY]: 'Severity',
      [TraitDimension.AREA]: 'Area',
      [TraitDimension.FLAG]: 'Flag',
    },
    values: {
      [TraitDimension.WORKFLOW_STATE]: {
        [WorkflowState.BACKLOG]: {
          name: 'Backlog',
          description: 'Created but not planned yet',
        },
        [WorkflowState.PLANNED]: {
          name: 'Planned',
          description: 'Planned and waiting to start',
        },
        [WorkflowState.ANALYSIS]: {
          name: 'Analysis',
          description: 'Requirements, refinement, breakdown',
        },
        [WorkflowState.DESIGN]: {
          name: 'Design',
          description: 'Mockups, UX, solution validation',
        },
        [WorkflowState.IN_PROGRESS]: {
          name: 'In progress',
          description: 'Being developed',
        },
        [WorkflowState.REVIEW]: {
          name: 'In review',
          description: 'Waiting for or in code review',
        },
        [WorkflowState.CHANGES_REQUESTED]: {
          name: 'Changes requested',
          description: 'The reviewer asked for changes',
        },
        [WorkflowState.READY_FOR_QA]: {
          name: 'Ready for QA',
          description: 'Development is done, waiting for QA',
        },
        [WorkflowState.TESTING]: {
          name: 'Testing',
          description: 'QA is testing it',
        },
        [WorkflowState.QA_PASSED]: {
          name: 'QA passed',
          description: 'QA confirmed it',
        },
        [WorkflowState.READY_FOR_RELEASE]: {
          name: 'Ready for release',
          description: 'Accepted, waiting for deployment',
        },
        [WorkflowState.STAGING]: {
          name: 'On staging',
          description: 'Deployed to a test stand or staging',
        },
        [WorkflowState.RELEASED]: {
          name: 'Released',
          description: 'In production, including behind a feature flag',
        },
        [WorkflowState.DONE]: {
          name: 'Done',
          description: 'The work is finished',
        },
        [WorkflowState.CANCELLED]: {
          name: 'Cancelled',
          description:
            'Will not be done: a duplicate, obsolete or not reproducible',
        },
        [WorkflowState.BLOCKED]: {
          name: 'Blocked',
          description: 'On hold or waiting for something external',
        },
        [WorkflowState.NEEDS_INFO]: {
          name: 'Needs info',
          description: 'Waiting for clarification',
        },
        [WorkflowState.HANDOFF]: {
          name: 'Handed off',
          description: 'Passed to another part of the team',
        },
      },
      [TraitDimension.TASK_KIND]: {
        [TaskKind.HOTFIX]: {
          name: 'Hotfix',
          description: 'An urgent fix in production',
        },
        [TaskKind.INCIDENT]: {
          name: 'Incident',
          description: 'A system failure',
        },
        [TaskKind.BUG]: { name: 'Bug', description: 'Something works wrong' },
        [TaskKind.FEATURE]: {
          name: 'Feature',
          description: 'A new capability',
        },
        [TaskKind.IMPROVEMENT]: {
          name: 'Improvement',
          description: 'Making something existing better',
        },
        [TaskKind.MAINTENANCE]: {
          name: 'Tech debt',
          description: 'Refactoring, cleanup, maintenance',
        },
        [TaskKind.DEPENDENCY]: {
          name: 'Dependencies',
          description: 'Library and dependency updates',
        },
        [TaskKind.EPIC]: {
          name: 'Epic',
          description: 'A large task with subtasks',
        },
        [TaskKind.QA_INTERNAL]: {
          name: 'QA task',
          description: 'Test plans, test data, QA tools',
        },
        [TaskKind.TEST_AUTOMATION]: {
          name: 'Test automation',
          description: 'Writing and fixing automated tests',
        },
        [TaskKind.DOCUMENTATION]: {
          name: 'Documentation',
          description: 'Docs, help, README',
        },
        [TaskKind.REQUIREMENTS]: {
          name: 'Requirements',
          description: 'Specifications and requirements',
        },
        [TaskKind.RESEARCH]: {
          name: 'Research',
          description: 'A spike, prototype or comparison',
        },
        [TaskKind.SUPPORT]: {
          name: 'Support',
          description: 'A user question or request',
        },
        [TaskKind.RELEASE]: {
          name: 'Release',
          description: 'Preparing and running a release',
        },
        [TaskKind.TASK]: {
          name: 'Task',
          description: 'A plain task without a special type',
        },
      },
      [TraitDimension.PRIORITY]: {
        [Priority.CRITICAL]: {
          name: 'Critical',
          description: 'Needed right now',
        },
        [Priority.HIGH]: { name: 'High', description: 'Needed soon' },
        [Priority.MEDIUM]: { name: 'Medium', description: 'As planned' },
        [Priority.LOW]: { name: 'Low', description: 'When there is time' },
      },
      [TraitDimension.SEVERITY]: {
        [Severity.BLOCKER]: {
          name: 'S1 — blocker',
          description: 'Work is impossible, no workaround',
        },
        [Severity.CRITICAL]: {
          name: 'S2 — critical',
          description: 'An important function does not work',
        },
        [Severity.MAJOR]: {
          name: 'S3 — major',
          description: 'Works with errors, there is a workaround',
        },
        [Severity.MINOR]: {
          name: 'S4 — minor',
          description: 'Cosmetic issues and small things',
        },
      },
      [TraitDimension.AREA]: {
        [TaskArea.FRONTEND]: {
          name: 'Frontend',
          description: 'The web interface',
        },
        [TaskArea.BACKEND]: { name: 'Backend', description: 'Server logic' },
        [TaskArea.MOBILE]: {
          name: 'Mobile app',
          description: 'iOS and Android',
        },
        [TaskArea.API]: {
          name: 'API',
          description: 'External and internal APIs, integrations',
        },
        [TaskArea.DATABASE]: {
          name: 'Database',
          description: 'Schema, migrations, queries, indexes',
        },
        [TaskArea.DATA]: {
          name: 'Data and analytics',
          description: 'DWH, ETL, BI, reports, dashboards',
        },
        [TaskArea.INFRASTRUCTURE]: {
          name: 'Infrastructure',
          description: 'Servers, cloud, networks, Kubernetes, monitoring',
        },
        [TaskArea.CI_CD]: {
          name: 'CI/CD',
          description: 'Builds, pipelines, deployment',
        },
        [TaskArea.SECURITY]: {
          name: 'Security',
          description: 'Vulnerabilities, access, certificates',
        },
        [TaskArea.PERFORMANCE]: {
          name: 'Performance',
          description: 'Speed, load, scaling',
        },
        [TaskArea.ACCESSIBILITY]: {
          name: 'Accessibility',
          description: 'Usability for people with disabilities',
        },
        [TaskArea.DESIGN]: {
          name: 'Design and UX',
          description: 'Mockups and usability',
        },
      },
      [TraitDimension.FLAG]: {
        [TaskFlag.EXCLUDE_FROM_REPORT]: {
          name: 'Not in report',
          description: 'The task stays out of the report',
        },
        [TaskFlag.RETURNED_FROM_QA]: {
          name: 'Returned from QA',
          description: 'QA sent the task back for changes',
        },
        [TaskFlag.E2E_REQUIRED]: {
          name: 'E2E tests needed',
          description: 'The task needs end-to-end tests',
        },
        [TaskFlag.UNIT_TESTS_REQUIRED]: {
          name: 'Unit tests needed',
          description: 'The task needs unit tests',
        },
        [TaskFlag.NEEDS_REBASE]: {
          name: 'Needs rebase',
          description: 'The branch is behind the target branch',
        },
        [TaskFlag.REGRESSION]: {
          name: 'Regression',
          description: 'Something that worked is broken',
        },
        [TaskFlag.FLAKY_TEST]: {
          name: 'Flaky test',
          description: 'The test passes and fails at random',
        },
        [TaskFlag.DRAFT]: {
          name: 'Draft',
          description: 'The MR is not ready to merge',
        },
        [TaskFlag.BREAKING_CHANGE]: {
          name: 'Breaking change',
          description: 'An incompatible change',
        },
        [TaskFlag.CUSTOMER_REQUEST]: {
          name: 'Customer request',
          description: 'Requested by a customer',
        },
      },
    },
  },
  traitList: {
    title: (count) => `**Traits** · GitLab labels: ${count}`,
    page: (page, pages) => `Page ${page} of ${pages}`,
    empty:
      'No labels yet. Press "Add": the bot asks for a label as in GitLab and the task trait it stands for.',
    previous: '‹ Back',
    next: 'Next ›',
    add: 'Add',
    menu: 'Menu',
    backToList: 'To the list',
    notFound: 'Label not found: it may have been deleted.',
    everyone: 'For everyone',
    addValue: 'Add a trait',
    drop: 'Delete the label',
  },
  traitManage: {
    askValue: (label, whom, dimension, value) =>
      `${label} ${whom} · ${dimension}\nNow: ${value}. Choose another trait or delete this one.`,
    deleteValue: 'Delete the trait',
    back: '‹ Back',
    changed: (label, whom, value) => `Done: ${label} ${whom} — now ${value}.`,
    valueDeleted: (label, whom, value) =>
      `Trait deleted: ${label} ${whom} — ${value}.`,
    labelEmpty: 'The label has no traits left and is gone from the list.',
    confirmDrop: (label, count) =>
      `Delete the label ${label}? Traits: ${count}.`,
    confirm: 'Yes, delete',
    cancel: 'Cancel',
    dropped: (label) => `The label ${label} is deleted.`,
  },
  traitAdd: {
    prompt:
      'Send the label as in GitLab, for example `status::easy`. Letter case, extra spaces and `_` do not matter.',
    invalid: (max) =>
      `This does not look like a label. Send it as in GitLab, for example \`status::easy\`, up to ${max} characters.`,
    exists: (label) => `The label ${label} is already set up.`,
    forWhom: (label) => `${label}\nWho is the trait for?`,
    everyone: 'For everyone',
    forEveryone: 'for everyone',
    forRole: (role) => `for the ${role} role`,
    chooseDimension: (label, whom) =>
      `${label} ${whom}\nWhat does this label mean? Choose a group of traits.`,
    chooseValue: (label, whom, dimension) =>
      `${label} ${whom} · ${dimension}\nChoose the task trait.`,
    alreadySet: (label) =>
      `The label ${label} already has a trait in this group for this role. You can change it in the card.`,
    added: (label, whom, value) => `Done: ${label} ${whom} — ${value}.`,
    openCard: 'Open the card',
    addMore: 'Add another',
    back: '‹ Back',
    cancel: 'Cancel',
    cancelled: 'Adding cancelled.',
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
    gitlabCertificate:
      "GitLab's certificate is not trusted: the bot's server needs your company's CA certificate. Owner: see `NODE_EXTRA_CA_CERTS` in the README.",
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
      [Permission.TRAITS]: 'map GitLab labels to task traits',
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
