import type { Language } from 'src/modules/application/i18n/i18n.enums';
import type { Locale } from 'src/modules/application/i18n/i18n.interface';
import type { GroupedDailyData } from 'src/modules/application/source/source.interface';
import type { User } from 'src/modules/application/user/user.interface';
import type { UserSource } from 'src/modules/application/user/user-source/user-source.interface';
import type { ActivityResult, ActivitySummary } from './activity/activity.interface';
import type { reports } from './report.schema';
import type { ReportContext } from './template/template.interface';

export type Report = typeof reports.$inferSelect;

export type ReportInsert = typeof reports.$inferInsert;

export interface ReportRequest {
  user: User;
  account: UserSource;
  date: string;
  language: Language;
}

export interface ReportDraft {
  timeZone: string;
  locale: Locale;
  day: GroupedDailyData;
  results: ActivityResult[];
  summaries: ActivitySummary[];
  context: ReportContext;
  content: string;
}
