import { UserRole } from 'src/modules/application/user/user.interface';
import { TaskType } from 'src/common/enums/task.enum';
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
import { TaskRole } from './git-mapper.interface';

//порог дней для определения «вернулся к работе»
const DAYS_THRESHOLD_RESUMED_WORK = 7;

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
  reportDate: string;
}

//разобранные лейблы задачи
export interface TaskLabels {
  priorities: LabelPriority[];
  types: LabelType[];
  currentStatus: LabelStatus | null;
  statusLabelsSetByCurrentUser: LabelStatus[];
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
}

//данные об апрувах
export interface TaskApprovals {
  currentUserApproved: boolean;
  otherApprovers: string[];
}

//контекст задачи
export class TaskContext {
  //тип задачи
  readonly taskType: TaskType;

  constructor(private readonly data: TaskContextData) {
    this.taskType = data.taskType;
  }

  //роль пользователя в задаче
  //текущий пользователь является исполнителем задачи
  isAssignee(): boolean {
    return this.data.userRoleInTask === TaskRole.ASSIGNEE;
  }

  //текущий пользователь назначен ревьюером
  isReviewer(): boolean {
    return this.data.userRoleInTask === TaskRole.REVIEWER;
  }

  //системная роль пользователя
  //пользователь разработчик
  isDeveloper(): boolean {
    return this.data.currentUserGlobalRole === UserRole.DEVELOPER;
  }

  //пользователь QA
  isQualityAssurance(): boolean {
    return this.data.currentUserGlobalRole === UserRole.QA;
  }

  //состояние артефактов
  //мр существует без привязанной задачи (хотфикс)
  isStandaloneMergeRequest(): boolean {
    return (
      this.data.activityStream.issueState === null &&
      this.data.activityStream.mergeRequestState !== null
    );
  }

  //задача в состоянии closed
  isIssueClosed(): boolean {
    return this.data.activityStream.issueState === GitLabIssueState.CLOSED;
  }

  //мр существует
  hasMergeRequest(): boolean {
    return this.data.activityStream.mergeRequestState !== null;
  }

  //мр в состоянии merged
  isMergeRequestMerged(): boolean {
    return (
      this.data.activityStream.mergeRequestState ===
      GitLabMergeRequestState.MERGED
    );
  }

  //задача закрыта и мр смерджена
  isIssueClosedWithMerge(): boolean {
    return this.isIssueClosed() && this.isMergeRequestMerged();
  }

  //тип задачи
  //задача типа баг
  isBug(): boolean {
    return this.data.taskType === TaskType.BUG;
  }

  //задача типа фича
  isFeature(): boolean {
    return this.data.taskType === TaskType.FEATURE;
  }

  //действия пользователя с кодом
  //текущий пользователь запушил код в мр
  currentUserPushedCode(): boolean {
    return this.data.activityStream.mergeRequestActions.some(
      (action) =>
        action === GitLabAction.PUSHED_TO || action === GitLabAction.PUSHED_NEW,
    );
  }

  //текущий пользователь открыл мр
  currentUserOpenedMergeRequest(): boolean {
    return this.data.activityStream.mergeRequestActions.includes(
      GitLabAction.OPENED,
    );
  }

  //текущий пользователь смерджил мр (accepted = merge в gitlab)
  currentUserMergedMergeRequest(): boolean {
    return this.data.activityStream.mergeRequestActions.includes(
      GitLabAction.ACCEPTED,
    );
  }

  //есть рабочие события в мр за день (пуш, открытие), но не мердж
  //помогает отличить "я работал сегодня" от "задача уже закрыта"
  hasActiveWorkOnMergeRequest(): boolean {
    return this.currentUserPushedCode() || this.currentUserOpenedMergeRequest();
  }

  //текущий пользователь создал задачу
  currentUserOpenedIssue(): boolean {
    return this.data.activityStream.issueActions.includes(GitLabAction.OPENED);
  }

  //текущий пользователь создал проект/репозиторий
  currentUserCreatedProject(): boolean {
    return this.data.activityStream.issueActions.includes(GitLabAction.CREATED);
  }

  //комментарии

  //текущий пользователь оставил комментарий к задаче
  currentUserCommentedOnIssue(): boolean {
    return this.data.activityStream.issueCommentsFromCurrentUser > 0;
  }

  //текущий пользователь оставил комментарий к мр
  currentUserCommentedOnMergeRequest(): boolean {
    return this.data.activityStream.mergeRequestCommentsFromCurrentUser > 0;
  }

  //текущий пользователь оставил комментарий где-либо (задача или мр)
  currentUserCommentedAnywhere(): boolean {
    return (
      this.currentUserCommentedOnIssue() ||
      this.currentUserCommentedOnMergeRequest()
    );
  }

  //обмен комментариями в мр: и я, и другие оставили комменты (диалог)
  hasReviewDialog(): boolean {
    return (
      this.currentUserCommentedOnMergeRequest() &&
      this.data.activityStream.mergeRequestCommentsFromOthers > 0
    );
  }

  //апрувы
  //текущий пользователь поставил апрув
  currentUserApproved(): boolean {
    return this.data.approvals.currentUserApproved;
  }

  //другие пользователи апрувнули мр
  isApprovedByOtherUsers(): boolean {
    return this.data.approvals.otherApprovers.length > 0;
  }

  //статус задачи
  //задача срочная (приоритет critical/high + тип bug)
  isUrgentTask(): boolean {
    const hasHighPriority =
      this.data.labels.priorities.includes(LabelPriority.CRITICAL) ||
      this.data.labels.priorities.includes(LabelPriority.HIGH);
    return hasHighPriority && this.data.labels.types.includes(LabelType.BUG);
  }

  //задача в статусе «в работе»
  isDoing(): boolean {
    return this.data.labels.currentStatus === LabelStatus.DOING;
  }

  //задача в статусе «на ревью»
  isInReview(): boolean {
    return this.data.labels.currentStatus === LabelStatus.REVIEW;
  }

  //задача в статусе «после ревью»
  isAfterReview(): boolean {
    return this.data.labels.currentStatus === LabelStatus.AFTER_REVIEW;
  }

  //задача в любой фазе ревью (review или after_review)
  isInReviewPhase(): boolean {
    return this.isInReview() || this.isAfterReview();
  }

  //лейблы — действия пользователя

  //текущий пользователь отправил задачу на ревью
  currentUserSentToReview(): boolean {
    return (
      this.isInReview() &&
      this.data.labels.statusLabelsSetByCurrentUser.includes(LabelStatus.REVIEW)
    );
  }

  //текущий пользователь запросил дополнительную информацию
  currentUserRequestedInformation(): boolean {
    return (
      this.data.labels.currentStatus === LabelStatus.NEED_INFORMATION &&
      this.data.labels.statusLabelsSetByCurrentUser.includes(
        LabelStatus.NEED_INFORMATION,
      )
    );
  }

  //текущий пользователь передал задачу на фронтенд
  currentUserPassedToFrontend(): boolean {
    return (
      this.data.labels.currentStatus === LabelStatus.FRONTEND &&
      this.data.labels.statusLabelsSetByCurrentUser.includes(
        LabelStatus.FRONTEND,
      )
    );
  }

  //мр создан в день отчёта (не раньше)
  isMergeRequestCreatedOnReportDate(): boolean {
    const createdAt = this.data.taskDates.mergeRequestCreatedAt;
    if (!createdAt) return false;

    const reportDay = this.data.taskDates.reportDate.slice(0, 10);
    const createdDay = createdAt.slice(0, 10);
    return reportDay === createdDay;
  }

  //работа возобновлена: MR создан более 7 дней назад
  isResumedWork(): boolean {
    const mergeRequestCreatedAt = this.data.taskDates.mergeRequestCreatedAt;
    if (!mergeRequestCreatedAt) return false;

    const daysSinceCreation =
      (new Date(this.data.taskDates.reportDate).getTime() -
        new Date(mergeRequestCreatedAt).getTime()) /
      (1000 * 60 * 60 * 24);

    return daysSinceCreation > DAYS_THRESHOLD_RESUMED_WORK;
  }
}
