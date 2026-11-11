import type { Channel } from 'src/common/channel/types/channel.enums';
import type { BotCommand } from 'src/modules/application/bot/core/types/bot.enums';
import type { Source } from 'src/modules/application/source/types/source.enums';
import type { Language } from './i18n.enums';
import type {
  Gender,
  JobRole,
  Permission,
  UserStatus,
} from 'src/modules/application/user/types/user.enums';

interface LocaleSwitch {
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
    sections: Record<BotCommand.REPORT | BotCommand.SETTINGS | BotCommand.ADMIN, string>;
  };
  cancel: {
    done: string;
    nothing: string;
  };
  admin: {
    title: string;
    noSections: string;
    broadcast: string;
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
    schedule: LocaleSwitch;
    ai: LocaleSwitch;
    aiData: LocaleSwitch;
    channels: LocaleSwitch;
    lastChannel: string;
    on: string;
    off: string;
    template: string;
  };
  templates: {
    title: string;
    current: (name: string) => string;
    standard: string;
    shared: (name: string) => string;
    mine: string;
    toSettings: string;
    chosen: (name: string) => string;
    notFound: string;
    mineTitle: (count: number) => string;
    mineEmpty: string;
    create: string;
    back: string;
    use: string;
    delete: string;
    backToMine: string;
    selected: (name: string) => string;
    confirmDelete: (name: string) => string;
    confirm: string;
    cancel: string;
    deleted: (name: string) => string;
    askName: (max: number) => string;
    nameInvalid: (max: number) => string;
    askBody: (name: string, max: number) => string;
    bodyInvalid: (max: number) => string;
    syntaxError: (error: string) => string;
    renderError: (error: string) => string;
    preview: (date: string) => string;
    emptyOutput: string;
    noPreview: string;
    previewHint: string;
    save: string;
    saved: (name: string) => string;
    cancelled: string;
    editText: string;
    rename: string;
    askNewName: (name: string, max: number) => string;
    renamed: (name: string) => string;
    bodyReplaced: (name: string) => string;
    editCancelled: string;
    backToTemplate: string;
  };
  sharedTemplates: {
    title: (count: number) => string;
    hint: string;
    empty: string;
    create: string;
    menu: string;
    usedBy: (count: number) => string;
    backToList: string;
    confirmDelete: (name: string, count: number) => string;
    saved: (name: string) => string;
  };
  broadcast: {
    title: string;
    askText: (max: number) => string;
    textInvalid: (max: number) => string;
    preview: string;
    recipients: (count: number) => string;
    noRecipients: string;
    previewHint: string;
    send: (count: number) => string;
    editText: string;
    cancel: string;
    sent: (count: number) => string;
    cancelled: string;
    menu: string;
  };
  adminSettings: {
    title: string;
    reportsOn: string;
    pausedToday: string;
    pausedUntil: (date: string) => string;
    pausedForever: string;
    hint: string;
    pauseToday: string;
    pauseUntil: string;
    pauseForever: string;
    resume: string;
    chooseDay: (days: number) => string;
    back: string;
    menu: string;
    aiAlways: string;
    aiNotConfigured: string;
    ai: LocaleSwitch;
    aiCommits: LocaleSwitch;
    aiComments: LocaleSwitch;
    on: string;
    off: string;
  };
}
