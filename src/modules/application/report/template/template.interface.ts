import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { Language } from 'src/modules/application/i18n/i18n.enums';
import type { GroupedDailyData } from 'src/modules/application/source/source.interface';
import type { Priority, TaskKind, WorkflowState } from 'src/modules/application/trait/trait.enums';
import type { Gender, JobRole } from 'src/modules/application/user/user.enums';
import type { ActivityAction, ActivityDetail, ActivityTier } from '../activity/activity.enums';
import type { ActivityResult, ActivitySummary } from '../activity/activity.interface';
import type { TemplateItemType } from './template.enums';
import type { reportTemplates } from './template.schema';

export type ReportTemplate = typeof reportTemplates.$inferSelect;

export type ReportTemplateInsert = typeof reportTemplates.$inferInsert;

export type ReportTemplateUpdate = PgUpdateSetSource<typeof reportTemplates>;

export interface TemplateEmployee {
  name: string;
  username: string;
  role: JobRole;
  gender: Gender;
}

export interface TemplateDay {
  date: string;
  language: Language;
  employee: TemplateEmployee;
  day: GroupedDailyData;
  results: ActivityResult[];
  summaries: ActivitySummary[];
}

export interface TemplateAction {
  action: ActivityAction;
  details: ActivityDetail[];
}

export interface TemplateItem extends TemplateAction {
  text: string;
  actionText: string;
  note: string | null;
  title: string | null;
  secondary: TemplateAction[];
  category: ActivityTier;
  kind: TaskKind | null;
  priority: Priority | null;
  state: WorkflowState | null;
  type: TemplateItemType;
  ref: string | null;
  url: string | null;
  projectName: string;
}

export interface TemplateProject {
  name: string;
  url: string | null;
  items: TemplateItem[];
}

export interface TemplateGroup {
  category: ActivityTier;
  name: string;
  items: TemplateItem[];
}

export interface ReportContext {
  version: number;
  date: string;
  dateText: string;
  weekday: string;
  language: Language;
  user: {
    name: string;
    username: string;
    role: JobRole;
    roleName: string;
  };
  isEmpty: boolean;
  itemsCount: number;
  projects: TemplateProject[];
  items: TemplateItem[];
  groups: TemplateGroup[];
  ai: { used: boolean };
}
