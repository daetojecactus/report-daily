import type {
  GroupedIssue,
  GroupedMergeRequest,
  SourceFact,
  StandalonePush,
} from 'src/modules/application/source/source.interface';
import type {
  Priority,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import type { JobRole } from 'src/modules/application/user/user.enums';
import type {
  ActivityAction,
  ActivityDetail,
  ActivityReason,
  ActivityRule,
  ActivityTier,
  EngagementLevel,
} from './activity.enums';

export interface ActivityEmployee {
  username: string;
  role: JobRole;
}

export interface ActivityLine {
  issue: GroupedIssue | null;
  mergeRequests: GroupedMergeRequest[];
  pushes: StandalonePush[];
}

export interface ActivityFact extends SourceFact {
  time: number;
  mergeRequestIid: number | null;
}

export interface ActivityDropped {
  fact: ActivityFact;
  rule: ActivityRule;
}

export interface ActivityChange {
  fact: ActivityFact;
  state: WorkflowState | null;
  flags: TaskFlag[];
  priority: Priority | null;
  returnedFrom: WorkflowState | null;
}

export interface ActivityPush {
  time: number;
  mergeRequestIid: number | null;
  commitCount: number;
  commitTitles: string[];
}

export interface ActivityLineSignals {
  line: ActivityLine;
  employee: ActivityEmployee;
  own: ActivityFact[];
  dropped: ActivityDropped[];
  others: ActivityFact[];
  changes: ActivityChange[];
  otherChanges: ActivityChange[];
  pushes: ActivityPush[];
  kind: TaskKind | null;
  kinds: TaskKind[];
  startStates: WorkflowState[];
  endStates: WorkflowState[];
  startFlags: TaskFlag[];
  endFlags: TaskFlag[];
  priority: Priority | null;
  removedFlags: TaskFlag[];
  ownMergeRequests: number[];
  assignee: boolean;
  createdToday: boolean;
  closedToday: boolean;
  mergedToday: boolean;
  lastCommitAt: number | null;
  returnedAt: number | null;
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
  parts: ActivityCandidate[];
}

export interface ActivityChain {
  isHead: (candidate: ActivityCandidate) => boolean;
  isPart: (candidate: ActivityCandidate, head: ActivityCandidate) => boolean;
  details: (parts: ActivityCandidate[]) => ActivityDetail[];
  state?: (parts: ActivityCandidate[]) => WorkflowState | null;
}

export interface ActivityRoleFocus {
  actions: ActivityAction[];
  states: WorkflowState[];
}

export interface ActivityRank {
  candidate: ActivityCandidate;
  tier: ActivityTier;
  weight: number;
}

export interface ActivityTrace {
  ranked: ActivityRank[];
  reason: ActivityReason;
  dropped: ActivityDropped[];
}

export interface ActivityChoice {
  main: ActivityCandidate;
  secondary: ActivityCandidate[];
  trace: ActivityTrace;
}

export interface ActivityResult {
  line: ActivityLine;
  signals: ActivityLineSignals;
  choice: ActivityChoice;
  excluded: boolean;
}
