import type {
  GroupedIssue,
  GroupedMergeRequest,
  SourceFact,
} from 'src/modules/application/source/source.interface';
import type {
  Priority,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import type { JobRole } from 'src/modules/application/user/user.enums';
import type { ActivityAction, ActivityDetail, EngagementLevel } from './activity.enums';

export interface ActivityEmployee {
  username: string;
  role: JobRole;
}

export interface ActivityLine {
  issue: GroupedIssue | null;
  mergeRequests: GroupedMergeRequest[];
}

export interface ActivityFact extends SourceFact {
  time: number;
  mergeRequestIid: number | null;
}

export interface ActivityChange {
  fact: ActivityFact;
  state: WorkflowState | null;
  flags: TaskFlag[];
  priority: Priority | null;
}

export interface ActivityPush {
  time: number;
  mergeRequestIid: number;
  commitCount: number;
  commitTitles: string[];
}

export interface ActivityLineSignals {
  line: ActivityLine;
  employee: ActivityEmployee;
  own: ActivityFact[];
  others: ActivityFact[];
  changes: ActivityChange[];
  pushes: ActivityPush[];
  kind: TaskKind | null;
  kinds: TaskKind[];
  startStates: WorkflowState[];
  endStates: WorkflowState[];
  startFlags: TaskFlag[];
  endFlags: TaskFlag[];
  removedFlags: TaskFlag[];
  ownMergeRequests: number[];
  assignee: boolean;
  createdToday: boolean;
  closedToday: boolean;
  mergedToday: boolean;
  lastCommitAt: number | null;
  dependencies: boolean;
  dialog: boolean;
  engagement: EngagementLevel;
}

export interface ActivityCandidate {
  action: ActivityAction;
  weight: number;
  time: number;
  state: WorkflowState | null;
  details: ActivityDetail[];
  facts: ActivityFact[];
}
