import { ReportStatus } from 'src/modules/application/report/report.enums';
import { Permission } from 'src/modules/application/user/user.enums';
import type { EmployeesLocale } from '../../i18n.interface';

export const enEmployees: EmployeesLocale = {
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
      lastActivity: 'Last activity in GitLab',
      activityHidden: 'not visible: the profile is closed or there are no events yet',
      activityUnknown: 'could not check',
      lastReport: 'Last report',
      noReport: 'none yet',
      reportStatuses: {
        [ReportStatus.PENDING]: 'queued',
        [ReportStatus.GENERATING]: 'being built',
        [ReportStatus.READY]: 'built',
        [ReportStatus.DELIVERED]: 'delivered',
        [ReportStatus.EMPTY]: 'no actions',
        [ReportStatus.FAILED]: 'could not build',
      },
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
    chooseRole: (name, role) => `**${name}**\nNow: ${role}. Choose the new role.`,
    roleChanged: (name, role) => `Role changed: **${name}** — ${role}.`,
    blocked: (name) =>
      `Employee blocked: **${name}**. The bot no longer answers them or sends reports.`,
    unblocked: (name) => `Employee unblocked: **${name}**.`,
    confirmDelete: (name) =>
      `Delete the employee **${name}**? Their channels and reports are deleted with them.`,
    deleted: (name) => `Employee deleted: **${name}**.`,
    self: 'You cannot block or delete yourself.',
    ownerOnly: 'Only an owner can block or delete an employee with permissions.',
    reportNow: 'Report now',
    reportQueued: (name) =>
      `Building today's report for **${name}**. It goes to the employee; if there are no actions or the build fails, I'll write here.`,
    reportEmpty: (name) => `**${name}** has no actions in GitLab today, so no report was sent.`,
    reportFailed: (name) => `Could not build the report for **${name}**: GitLab did not answer.`,
    reportUnavailable: (name) =>
      `**${name}** cannot get a report: the employee is not active or has no Telegram connected.`,
  },
  employeePermissions: {
    open: 'Permissions',
    title: (name) => `**${name}**\nPermissions in the bot. Tap one to grant or revoke it.`,
    descriptions: {
      [Permission.USERS]: 'add, change, block and delete employees',
      [Permission.TRAITS]: 'map GitLab labels to task traits',
      [Permission.BROADCAST]: 'send a broadcast to all employees',
      [Permission.SETTINGS]: 'report pause, AI, calendar, system status',
      [Permission.TEMPLATES]: 'create, edit and delete shared report templates',
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
    taken: (name) => `This account is already bound to **${name}**. Enter another ID.`,
    alreadyBound: (channel) => `The employee already has ${channel} bound.`,
    bound: (channel, name) => `${channel} bound: **${name}**.`,
    hint: 'If the employee has not written to the bot yet, ask them to open it and press Start.',
    cancel: 'Cancel',
    cancelled: 'Binding cancelled.',
  },
};
