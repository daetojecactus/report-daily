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
}
