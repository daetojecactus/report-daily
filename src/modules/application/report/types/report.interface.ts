import type { AiPolicy } from 'src/modules/application/ai/types/ai.interface';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { Language } from 'src/modules/application/i18n/types/i18n.enums';
import type { Locale } from 'src/modules/application/i18n/types/i18n.interface';
import type { GroupedDailyData } from 'src/modules/application/source/types/source-day.interface';
import type { TraitIndex } from 'src/modules/application/trait/types/trait.interface';
import type { User } from 'src/modules/application/user/types/user.interface';
import type { UserSource } from 'src/modules/application/user/user-source/types/user-source.interface';
import type { ActivityResult, ActivitySummary } from '../activity/types/activity.interface';
import type { reports } from '../report.schema';
import type { ReportContext } from '../template/types/template.interface';

export type Report = typeof reports.$inferSelect;

export type ReportInsert = typeof reports.$inferInsert;

export type ReportUpdate = PgUpdateSetSource<typeof reports>;

export interface ReportRequest {
  user: User;
  account: UserSource;
  date: string;
  language: Language;
  ai: AiPolicy | null;
}

export interface ReportDraft {
  timeZone: string;
  locale: Locale;
  day: GroupedDailyData;
  results: ActivityResult[];
  summaries: ActivitySummary[];
  context: ReportContext;
  content: string;
  templateId: string | null;
  aiModel: string | null;
}

export interface ReportRewriting {
  user: User;
  locale: Locale;
  policy: AiPolicy;
  index: TraitIndex;
}
