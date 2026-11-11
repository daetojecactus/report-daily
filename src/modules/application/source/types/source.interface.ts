import type { UserSource } from 'src/modules/application/user/user-source/types/user-source.interface';
import type { LabelAction, Source, SourceActionKind, SourceRefType } from './source.enums';
import type { GroupedDailyData } from './source-day.interface';

export interface SourceFact {
  kind: SourceActionKind;
  at: string;
  actor: string | null;
  own: boolean;
  value: string | null;
  users: string[];
}

interface CleanCommit {
  id: string;
  title: string;
}

export interface CleanPushData {
  commitCount: number;
  action: string;
  refType: SourceRefType;
  ref: string | null;
  refCount: number | null;
  commitTitle: string | null;
  commits: CleanCommit[];
}

export interface CleanEvent {
  id: number;
  projectId: number | null;
  actionName: string;
  targetType: string | null;
  targetTitle: string | null;
  createdAt: string;
  pushData?: CleanPushData;
  noteBody?: string;
}

export interface CleanNote {
  id: number;
  body: string;
  authorUsername: string;
  authorName: string;
  createdAt: string;
  system: boolean;
  noteableType: string;
  resolvable: boolean;
  resolved?: boolean;
}

export interface CleanLabelEvent {
  id: number;
  labelName: string;
  action: LabelAction;
  createdAt: string;
  username: string;
}

export interface ActivitySource {
  readonly source: Source;
  collect(account: UserSource, date: string, timeZone: string): Promise<GroupedDailyData>;
}
