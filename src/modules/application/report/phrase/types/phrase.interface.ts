import type {
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/types/trait.enums';
import type { JobRole } from 'src/modules/application/user/types/user.enums';
import type { ActivityAction, ActivityDetail } from '../../activity/types/activity.enums';
import type { PHRASE_SUMMARIES } from '../constants/phrase.constants';
import type { ReportPhrase } from './phrase.enums';

export type SummaryPhrase = (typeof PHRASE_SUMMARIES)[number];

export interface PhraseRule {
  action: ActivityAction;
  phrase: ReportPhrase;
  details?: ActivityDetail[];
  kinds?: TaskKind[];
  flags?: TaskFlag[];
  roles?: JobRole[];
  states?: WorkflowState[];
  endStates?: WorkflowState[];
  issue?: boolean;
  pushed?: boolean;
  assignee?: boolean;
  merged?: boolean;
}

export interface PhraseParts {
  text: string;
  actionText: string;
  title: string | null;
  note: string | null;
}
