import type { TaskStatus } from '../enums/task.enum';

export enum Language {
  RU = 'ru',
  EN = 'en',
}

export interface GenderedText {
  male: string;
  female: string;
}

export interface Locale {
  taskActions: Record<TaskStatus, GenderedText>;

  report: {
    qaReviewed: string;
    qaBugs: string;
    qaAutoTests: string;
    qaOther: string;
    noActivity: string;
  };

  //человекочитаемые названия сущностей (статусы, роли, шаблоны, пол)
  entities: {
    userStatus: Record<string, string>;
    userRole: Record<string, string>;
    reportTemplate: Record<string, string>;
    gender: Record<string, string>;
  };

  ai: {
    systemPrompt: string;
    genderMale: string;
    genderFemale: string;
    labels: {
      task: string;
      action: string;
      type: string;
      commits: string;
      comments: string;
      mr: string;
    };
    tasksWord: string;
    responseWord: string;
  };

  commands: {
    role: string;
    status: string;
    reportHour: string;
    ai: string;
    template: string;
    language: string;
    aiMode: string;
    enable: string;
    disable: string;
    selectOption: string;
    currentHour: string;
    selectHour: string;
    selectLanguage: string;
    availableCommands: string;
    reportQueued: string;
    aiEnabled: string;
    aiDisabled: string;
    hourUpdated: string;
    languageUpdated: string;
    notRegistered: string;
    welcome: string;
    russian: string;
    english: string;
    descriptions: Record<string, string>;
  };

  admin: {
    unknownCommand: string;
    userCreated: string;
    userUpdated: string;
    userNotFound: string;
    invalidArgs: string;
    createError: string;
    updateError: string;
    noUsers: string;
    blocked: string;
    unblocked: string;
    parseError: string;
    unknownAction: string;
    unknownField: string;
    reportError: string;
    selectUserBlock: string;
    selectUserUnblock: string;
    selectUserInfo: string;
    selectUserReport: string;
    selectUserUpdate: string;
    selectField: string;
    selectRole: string;
    selectStatus: string;
    selectHour: string;
    selectTemplate: string;
    selectLanguage: string;
    enterAdminId: string;
    enterTelegramId: string;
    selectRoleWizard: string;
    selectHourWizard: string;
    adminIdNoSpaces: string;
    telegramIdMustBeNumber: string;
    telegramIdAndHourMustBeNumbers: string;
    validRoles: string;
    userInfoTitle: string;
    telegramId: string;
    gitlabId: string;
    portalId: string;
    gender: string;
    yes: string;
    no: string;
    usersTitle: string;
    broadcastEnterText: string;
    broadcastPreview: string;
    broadcastSend: string;
    broadcastCancel: string;
    broadcastQueued: string;
    broadcastCancelled: string;
    broadcastEmpty: string;
    broadcastNoRecipients: string;
  };
}
