import type { TaskFlag, TaskKind, WorkflowState } from 'src/modules/application/trait/trait.enums';
import type { JobRole } from 'src/modules/application/user/user.enums';
import type { ActivityAction, ActivityDetail } from '../activity/activity.enums';
import type { PHRASE_SUMMARIES } from './constants/phrase.constants';
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
