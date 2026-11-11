import type {
  PhraseContext,
  PhraseCount,
  PhraseName,
  ReportPhrase,
} from 'src/modules/application/report/phrase/types/phrase.enums';
import type { ActivityTier } from 'src/modules/application/report/activity/types/activity.enums';
import type { SummaryPhrase } from 'src/modules/application/report/phrase/types/phrase.interface';
import type { WorkflowState } from 'src/modules/application/trait/types/trait.enums';
import type { Gender } from 'src/modules/application/user/types/user.enums';

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
