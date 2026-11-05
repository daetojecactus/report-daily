import type { Channel } from 'src/common/enums/channel.enums';
import type { BotCommand } from 'src/modules/application/bot/bot.enums';
import type { Language } from './i18n.enums';
import type {
  Gender,
  JobRole,
  Permission,
  UserStatus,
} from 'src/modules/application/user/user.enums';

export interface LocaleSwitch {
  name: string;
  description: string;
}

export interface Locale {
  channels: Record<Channel, string>;
  languages: Record<Language, string>;
  commands: Record<BotCommand, string>;
  roles: Record<JobRole, string>;
  genders: Record<Gender, string>;
  statuses: Record<UserStatus, string>;
  permissions: Record<Permission, string>;
  bot: {
    noAccess: (channel: string, id: string) => string;
    forbidden: string;
    unknownCommand: string;
    unknownInput: string;
    expired: string;
    error: string;
  };
  start: {
    owner: string;
    employee: (name: string) => string;
  };
  help: {
    title: string;
    privacy: string;
  };
  cancel: {
    done: string;
    nothing: string;
  };
  admin: {
    title: string;
    noSections: string;
  };
  settings: {
    title: string;
    language: string;
    reportTime: string;
    timeZone: string;
    defaultTimeZone: (zone: string) => string;
    useDefault: (zone: string) => string;
    back: string;
    chooseLanguage: string;
    chooseHour: (zone: string) => string;
    chooseMinute: string;
    timeZonePrompt: (zone: string) => string;
    timeZoneInvalid: string;
    gender: string;
    chooseGender: string;
    ai: LocaleSwitch;
    aiData: LocaleSwitch;
    on: string;
    off: string;
  };
  employees: {
    title: (count: number) => string;
    page: (page: number, pages: number) => string;
    empty: string;
    previous: string;
    next: string;
    search: string;
    add: string;
    bind: (channel: string) => string;
    menu: string;
    backToList: string;
    searchPrompt: string;
    searchTitle: (query: string) => string;
    searchEmpty: string;
    searchTooMany: (limit: number) => string;
    notFound: string;
    card: {
      gitlab: string;
      role: string;
      gender: string;
      status: string;
      channels: string;
      permissions: string;
      noChannels: string;
      reachable: string;
      unreachable: string;
    };
  };
  employeeAdd: {
    prompt: string;
    gitlabUnavailable: string;
    noMatches: string;
    pick: (query: string) => string;
    role: (name: string) => string;
    gender: (name: string) => string;
    alreadyAdded: (name: string) => string;
    added: (name: string) => string;
    activityHidden: string;
    activityUnknown: string;
    pending: string;
    openCard: string;
    cancel: string;
    cancelled: string;
  };
  employeeManage: {
    changeRole: string;
    block: string;
    unblock: string;
    delete: string;
    confirm: string;
    cancel: string;
    chooseRole: (name: string, role: string) => string;
    roleChanged: (name: string, role: string) => string;
    blocked: (name: string) => string;
    unblocked: (name: string) => string;
    confirmDelete: (name: string) => string;
    deleted: (name: string) => string;
    self: string;
    ownerOnly: string;
  };
  employeePermissions: {
    open: string;
    title: (name: string) => string;
    descriptions: Record<Permission, string>;
    granted: string;
    revoked: string;
  };
  employeeBind: {
    prompt: (channel: string, name: string) => string;
    pick: (channel: string) => string;
    pickPrompt: string;
    pickButton: string;
    invalid: (channel: string) => string;
    taken: (name: string) => string;
    alreadyBound: (channel: string) => string;
    bound: (channel: string, name: string) => string;
    hint: string;
    cancel: string;
    cancelled: string;
  };
}
