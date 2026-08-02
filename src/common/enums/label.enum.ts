export enum LabelScope {
  STATUS = 'status',
  TYPE = 'type',
  PRIORITY = 'priority',
  QA = 'qa',
  TEST = 'test',
}

export enum LabelPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum LabelType {
  //type::ignore — задача помечена как не идущая в отчёт
  IGNORE = 'ignore',
  HOTFIX = 'hotfix',
  BUG = 'bug',
  FEATURE = 'feature',
  MAINTENANCE = 'maintenance',
  EPIC = 'epic',
  E2E = 'e2e',
  QA = 'qa',
}

export enum LabelStatus {
  TODO = 'todo',
  SPRINT_BACKLOG = 'sprint backlog',
  DOING = 'doing',
  REVIEW = 'review',
  AFTER_REVIEW = 'after review',
  TESTING = 'testing',
  FRONTEND = 'frontend',
  NEED_INFORMATION = 'need information',
  HOLD = 'hold',
  READY_FOR_QA = 'ready for qa',
  QA_IN_PROGRESS = 'qa in progress',
  QA_PASSED = 'qa passed',
}

export enum LabelQa {
  RETURNED_TO_DEVELOPMENT = 'returned to development',
}

export enum LabelTest {
  E2E_REQUIRED = 'e2e required',
  UNIT = 'unit',
}

export enum LabelApp {
  ADMIN = 'admin',
  CLIENT = 'client',
  SERVER = 'server',
}

export const LABEL_NEEDS_REBASE = 'needs-rebase';
