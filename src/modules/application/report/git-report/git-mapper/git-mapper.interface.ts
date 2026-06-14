import type { TaskStatus, TaskType } from 'src/common/enums/task.enum';
import type {
  GroupedIssue,
  StandaloneMergeRequest,
  StandalonePush,
} from '../git-group/git-group.interface';
import { UserRole } from 'src/modules/application/user/user.enums';
import { EngagementLevel, TaskRole } from './git-mapper.enums';
import {
  LabelPriority,
  LabelStatus,
  LabelType,
} from 'src/common/enums/label.enum';
import {
  GitLabAction,
  GitLabIssueState,
  GitLabMergeRequestState,
} from 'src/common/enums/gitlab.enum';

//результат анализа действий — что именно было сделано
export interface WorkResult {
  status: TaskStatus;
  taskType: TaskType;
}

//задача с определенным статусом работы
export interface MappedIssue extends GroupedIssue {
  workResult: WorkResult;
}

//MR с определенным статусом работы (хотфиксы и т.д. без задачи)
export interface MappedMergeRequest extends StandaloneMergeRequest {
  workResult: WorkResult;
}

//пуш с определенным статусом работы
export interface MappedPush extends StandalonePush {
  workResult: WorkResult;
}

//полностью обработанные данные за день
export interface MappedDailyData {
  issues: MappedIssue[];
  standaloneMergeRequests: MappedMergeRequest[];
  standalonePushes: MappedPush[];
}

//входные данные для создания контекста задачи
export interface TaskContextData {
  currentUserGlobalRole: UserRole;
  userRoleInTask: TaskRole;
  taskType: TaskType;
  taskDates: TaskDates;
  labels: TaskLabels;
  activityStream: ActivityStream;
  approvals: TaskApprovals;
}

//временные метки жизненного цикла задачи
export interface TaskDates {
  issueCreatedAt: string | null;
  mergeRequestCreatedAt: string | null;
  //дата последнего коммита до дня отчёта (null если ранее коммитов не было)
  mergeRequestLastCommitAt: string | null;
  reportDate: string;
}

//разобранные лейблы задачи
export interface TaskLabels {
  priorities: LabelPriority[];
  types: LabelType[];
  currentStatus: LabelStatus | null;
  previousStatus: LabelStatus | null;
  statusLabelsSetByCurrentUser: LabelStatus[];
  priorityChangedByCurrentUser: boolean;
}

//поток активности пользователя
export interface ActivityStream {
  issueState: GitLabIssueState | null;
  mergeRequestState: GitLabMergeRequestState | null;
  issueActions: GitLabAction[];
  mergeRequestActions: GitLabAction[];
  issueCommentsFromCurrentUser: number;
  mergeRequestCommentsFromCurrentUser: number;
  mergeRequestCommentsFromOthers: number;
  mergeRequestCommitCount: number;
}

//данные об апрувах
export interface TaskApprovals {
  currentUserApproved: boolean;
  otherApprovers: string[];
}

export interface EngagementSignals {
  isAssignee: boolean;
  isReviewer: boolean;
  isIssueAuthor: boolean;
  isMergeRequestAuthor: boolean;
  mergedMergeRequest: boolean;
  commitCount: number;
  commentCount: number;
  statusChangesCount: number;
  escalatedPriority: boolean;
}

export interface EngagementResult {
  score: number;
  level: EngagementLevel;
}
