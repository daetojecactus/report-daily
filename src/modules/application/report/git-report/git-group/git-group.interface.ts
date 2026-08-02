import type {
  GitLabIssueState,
  GitLabMergeRequestState,
  ParsedEventType,
} from 'src/common/enums/gitlab.enum';

//очищенное событие без лишних данных (аватары и тд)
export interface CleanEvent {
  id: number;
  projectId: number;
  actionName: string;
  targetType: string | null;
  targetTitle: string | null;
  createdAt: string;
  pushData?: {
    commitCount: number;
    action: string;
    refType: string;
    ref: string;
    commitTitle: string | null;
  };
  noteBody?: string;
}

//очищенный комментарий
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

//очищенное событие смены лейбла
export interface CleanLabelEvent {
  id: number;
  labelName: string;
  action: 'add' | 'remove';
  createdAt: string;
  username: string;
}

//статистика тредов ревью по мр за всё время, а не только за день отчёта:
//треды могли быть заведены раньше, а закрыты сегодня
export interface ReviewThreads {
  //сколько всего резолвабельных тредов в мр
  total: number;
  //сколько из них ещё не закрыто
  unresolved: number;
}

export interface GroupedMergeRequest {
  projectId: number;
  iid: number;
  title: string;
  state: GitLabMergeRequestState;
  //мр смерджен именно в день отчёта, а не когда-то раньше
  mergedOnReportDate: boolean;
  webUrl: string;
  sourceBranch: string;
  labels: string[];
  createdAt: string;
  //дата последнего коммита до дня отчёта (null если ранее коммитов не было)
  lastCommitAt: string | null;
  //автор мр (кто открыл) — устойчивый признак «своей» работы
  author: string | null;
  assignee: string | null;
  //ревьюеры: текущие + все, кто когда-либо был назначен ревьюером (по истории)
  reviewers: string[];
  events: CleanEvent[];
  notes: CleanNote[];
  labelEvents: CleanLabelEvent[];
  reviewThreads: ReviewThreads;
}

export interface GroupedIssue {
  projectId: number;
  iid: number;
  title: string;
  state: GitLabIssueState;
  //задача закрыта именно в день отчёта, а не когда-то раньше
  closedOnReportDate: boolean;
  webUrl: string;
  labels: string[];
  createdAt: string;
  assignee: string | null;
  events: CleanEvent[];
  notes: CleanNote[];
  labelEvents: CleanLabelEvent[];
  mergeRequests: GroupedMergeRequest[];
}

export interface StandaloneMergeRequest {
  projectId: number;
  iid: number;
  title: string;
  state: GitLabMergeRequestState;
  //мр смерджен именно в день отчёта, а не когда-то раньше
  mergedOnReportDate: boolean;
  webUrl: string;
  sourceBranch: string;
  labels: string[];
  createdAt: string;
  //дата последнего коммита до дня отчёта (null если ранее коммитов не было)
  lastCommitAt: string | null;
  //автор мр (кто открыл) — устойчивый признак «своей» работы
  author: string | null;
  assignee: string | null;
  //ревьюеры: текущие + все, кто когда-либо был назначен ревьюером (по истории)
  reviewers: string[];
  events: CleanEvent[];
  notes: CleanNote[];
  labelEvents: CleanLabelEvent[];
  reviewThreads: ReviewThreads;
}

export interface StandalonePush {
  projectId: number;
  branch: string;
  events: CleanEvent[];
}

export interface GroupedDailyData {
  issues: GroupedIssue[];
  standaloneMergeRequests: StandaloneMergeRequest[];
  standalonePushes: StandalonePush[];
}

export interface ParsedEvent {
  type: ParsedEventType;
  projectId: number;
  iid?: number | null;
  branch?: string;
}
