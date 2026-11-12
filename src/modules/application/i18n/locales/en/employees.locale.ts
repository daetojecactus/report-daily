import { Channel } from 'src/common/channel/types/channel.enums';
import { ReportStatus } from 'src/modules/application/report/types/report.enums';
import type { EmployeesLocale } from '../../types/i18n-employees.interface';

export const enEmployees: EmployeesLocale = {
  employees: {
    title: (count) => `**Employees** · ${count}`,
    page: (page, pages) => `Page ${page} of ${pages}`,
    empty: 'No employees yet.',
    previous: 'Back',
    next: 'Next',
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
      access: 'Access',
      admin: 'admin, publishes shared templates',
      noChannels: 'not connected',
      reachable: 'connected',
      unreachable: 'unreachable, the bot cannot write there',
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
      "GitLab's certificate is not trusted: the bot's server needs the certificate of the authority that signed GitLab. Owner: the `NODE_EXTRA_CA_CERTS` environment variable.",
    noMatches: 'Nobody found in GitLab. Try another name or username.',
    pick: (query) => `**GitLab:** ${query}\nChoose the employee.`,
    role: (name) => `**${name}**\nChoose the role.`,
    gender: (name) => `**${name}**\nChoose the gender.`,
    alreadyAdded: (name) => `**${name}** is already an employee.`,
    added: (name) => `Employee added: **${name}**.`,
    activityHidden:
      'GitLab shows no events of this employee: the profile is private or there was no activity yet. If the profile is private, ask them to make it public.',
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
    makeAdmin: 'Make admin',
    removeAdmin: 'Remove admin',
    madeAdmin: (name) => `**${name}** is an admin now: they create and edit shared templates.`,
    removedAdmin: (name) => `**${name}** is no longer an admin.`,
    reportNow: 'Report now',
    reportQueued: (name) =>
      `Building today's report for **${name}**. It goes to the employee; if there are no actions or the build fails, I'll write here.`,
    reportEmpty: (name) => `**${name}** has no actions in GitLab today, so no report was sent.`,
    reportFailed: (name) => `Could not build the report for **${name}**: GitLab did not answer.`,
    reportUnavailable: (name) =>
      `**${name}** cannot get a report: the employee is not active or has no bound channel.`,
  },
  employeeBind: {
    prompt: (channel, name) =>
      `**${name}**\nChoose the employee in ${channel} or enter their ${channel} ID.`,
    promptId: (channel, name) => `**${name}**\nEnter the employee's ${channel} ID.`,
    idHint: {
      [Channel.TELEGRAM]:
        'A Telegram ID is a number. It is easier to pick the employee with "Choose in Telegram".',
      [Channel.SLACK]:
        'The Slack ID is in the member profile: the three-dot menu, item "Copy member ID".',
    },
    pick: (channel) => `Choose in ${channel}`,
    pickPrompt: {
      [Channel.TELEGRAM]:
        'Press "Choose the employee" at the bottom of the screen and pick them from your chats or contacts. Cancel with /cancel.',
      [Channel.SLACK]: 'Choose the employee in the list below. Cancel with /cancel.',
    },
    pickButton: 'Choose the employee',
    invalid: (channel) => `This does not look like a ${channel} ID.`,
    taken: (name) => `This account is already bound to **${name}**. Enter another ID.`,
    alreadyBound: (channel) => `The employee already has ${channel} bound.`,
    bound: (channel, name) => `${channel} bound: **${name}**.`,
    hint: {
      [Channel.TELEGRAM]:
        'If the employee has not written to the bot yet, ask them to open it and press Start.',
      [Channel.SLACK]:
        'The bot writes to the employee in Slack direct messages itself; they do not need to do anything.',
    },
    unbind: (channel) => `Unbind ${channel}`,
    confirmUnbind: (channel, name) =>
      `Unbind ${channel} from **${name}**? Reports and broadcasts stop going there, and the bot stops answering the employee there.`,
    confirmUnbindButton: 'Yes, unbind',
    unbound: (channel, name) => `${channel} unbound from **${name}**.`,
    notBound: (channel) => `The employee has no ${channel} bound.`,
    cancel: 'Cancel',
    cancelled: 'Binding cancelled.',
  },
};
