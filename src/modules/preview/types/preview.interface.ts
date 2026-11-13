import type { Language } from 'src/modules/application/i18n/types/i18n.enums';
import type {
  ActivityResult,
  ActivitySummary,
} from 'src/modules/application/report/activity/types/activity.interface';

export interface PreviewTexts {
  lines: Map<ActivityResult, string>;
  summaries: Map<ActivitySummary, string>;
}

export interface PreviewOptions {
  trace: boolean;
  language: Language | null;
  ai: boolean;
  aiComments: boolean;
}
