import type { Channel } from 'src/common/enums/channel.enums';
import type { BotCommand } from 'src/modules/application/bot/bot.enums';
import type {
  Gender,
  JobRole,
  Permission,
  UserStatus,
} from 'src/modules/application/user/user.enums';

export interface Locale {
  channels: Record<Channel, string>;
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
