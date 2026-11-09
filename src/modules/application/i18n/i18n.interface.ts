import type { Channel } from 'src/common/enums/channel.enums';
import type { BotCommand } from 'src/modules/application/bot/bot.enums';
import type {
  PhraseContext,
  PhraseCount,
  PhraseName,
  ReportPhrase,
} from 'src/modules/application/report/phrase/phrase.enums';
import type { ActivityTier } from 'src/modules/application/report/activity/activity.enums';
import type { SummaryPhrase } from 'src/modules/application/report/phrase/phrase.interface';
import type { TraitDimension, WorkflowState } from 'src/modules/application/trait/trait.enums';
import type { TraitDimensionValueMap } from 'src/modules/application/trait/trait.interface';
import type { Source } from 'src/modules/application/source/source.enums';
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

export interface TraitValueText {
  name: string;
  description: string;
}

export interface CommonLocale {
  channels: Record<Channel, string>;
  sources: Record<Source, string>;
  languages: Record<Language, string>;
  commands: Record<BotCommand, string>;
  report: {
    choose: string;
    today: string;
    yesterday: string;
    otherDay: string;
    chooseDay: (days: number) => string;
    back: string;
    todayText: string;
    yesterdayText: string;
    building: (day: string) => string;
    rebuilding: (day: string) => string;
    empty: (day: string) => string;
    failed: string;
    rebuild: string;
    wait: (seconds: number) => string;
  };
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
}

export interface TraitsLocale {
  traits: {
    dimensions: Record<TraitDimension, string>;
    values: {
      [Dimension in TraitDimension]: Record<TraitDimensionValueMap[Dimension], TraitValueText>;
    };
  };
  traitList: {
    title: (count: number) => string;
    page: (page: number, pages: number) => string;
    empty: string;
    previous: string;
    next: string;
    add: string;
    menu: string;
    backToList: string;
    notFound: string;
    everyone: string;
    addValue: string;
    drop: string;
    unmapped: (count: number) => string;
  };
  traitNames: {
    title: (count: number) => string;
    hint: (days: number) => string;
    empty: (days: number) => string;
    ignoredTitle: (count: number) => string;
    ignoredHint: string;
    ignoredEmpty: string;
    showIgnored: (count: number) => string;
    showUnmapped: string;
    backToTraits: string;
    card: string;
    ignoredCard: string;
    map: string;
    ignore: string;
    restore: string;
    back: string;
    notFound: string;
    ignored: (label: string) => string;
    restored: (label: string) => string;
  };
  traitManage: {
    askValue: (label: string, whom: string, dimension: string, value: string) => string;
    deleteValue: string;
    back: string;
    changed: (label: string, whom: string, value: string) => string;
    valueDeleted: (label: string, whom: string, value: string) => string;
    labelEmpty: string;
    confirmDrop: (label: string, count: number) => string;
    confirm: string;
    cancel: string;
    dropped: (label: string) => string;
  };
  traitAdd: {
    prompt: string;
    invalid: (max: number) => string;
    exists: (label: string) => string;
    forWhom: (label: string) => string;
    everyone: string;
    forEveryone: string;
    forRole: (role: string) => string;
    chooseDimension: (label: string, whom: string) => string;
    chooseValue: (label: string, whom: string, dimension: string) => string;
    alreadySet: (label: string) => string;
    added: (label: string, whom: string, value: string) => string;
    openCard: string;
    addMore: string;
    back: string;
    cancel: string;
    cancelled: string;
  };
}

export interface EmployeesLocale {
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
    gitlabCertificate: string;
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

export type GenderedText = string | Record<Gender, string>;

export interface PhrasesLocale {
  phrases: {
    actions: Record<ReportPhrase, GenderedText>;
    contexts: Record<PhraseContext, string>;
    states: Record<WorkflowState, string>;
    closed: string;
    stateLine: (state: string) => string;
    stateNote: (state: string) => string;
    quote: (title: string) => string;
    withNote: (text: string, note: string) => string;
    names: Record<PhraseName, (name: string | null) => string>;
    counts: Record<PhraseCount, (count: number | null) => string>;
    summaries: Record<SummaryPhrase, (count: number) => GenderedText>;
    summaryLine: (text: string, references: string) => string;
    dateLocale: string;
    categories: Record<ActivityTier, string>;
  };
}

export type Locale = CommonLocale & TraitsLocale & EmployeesLocale & PhrasesLocale;
