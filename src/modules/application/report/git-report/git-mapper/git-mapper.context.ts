import { UserRole } from 'src/modules/application/user/user.enums';
import { TaskType } from 'src/common/enums/task.enum';
import {
  LabelPriority,
  LabelQa,
  LabelStatus,
  LabelTest,
  LabelType,
} from 'src/common/enums/label.enum';
import {
  GitLabAction,
  GitLabMergeRequestState,
} from 'src/common/enums/gitlab.enum';
import { calculateEngagement } from './git-mapper.engagement';
import {
  GIT_MAPPER_DAYS_THRESHOLD_RESUMED_WORK,
  GIT_MAPPER_MANY_COMMENTS_THRESHOLD,
  GIT_MAPPER_TEST_COMMIT_PATTERN,
} from './constants/git-mapper.constants';
import { EngagementLevel, TaskRole } from './git-mapper.enums';
import type { EngagementResult, TaskContextData } from './git-mapper.interface';

//контекст задачи
export class TaskContext {
  //тип задачи
  readonly taskType: TaskType;

  //лениво вычисляемая степень вовлечённости
  private engagementCache: EngagementResult | null = null;

  constructor(private readonly data: TaskContextData) {
    this.taskType = data.taskType;
  }

  //роли пользователя в задаче

  //текущий пользователь является исполнителем задачи
  isAssignee(): boolean {
    return this.data.userRoleInTask === TaskRole.ASSIGNEE;
  }

  //текущий пользователь назначен ревьюером
  isReviewer(): boolean {
    return this.data.userRoleInTask === TaskRole.REVIEWER;
  }

  //текущий пользователь — автор задачи (создал, но не исполнитель)
  isAuthor(): boolean {
    return this.data.userRoleInTask === TaskRole.AUTHOR;
  }

  //текущий пользователь — наблюдатель (не assignee, не reviewer, не author)
  isObserver(): boolean {
    return this.data.userRoleInTask === TaskRole.OBSERVER;
  }

  //глобальные роли пользователя

  //пользователь QA
  isQualityAssurance(): boolean {
    return this.data.currentUserGlobalRole === UserRole.QA;
  }

  //пользователь PM
  isProjectManager(): boolean {
    return this.data.currentUserGlobalRole === UserRole.PROJECT_MANAGER;
  }

  //пользователь системный аналитик
  isSystemAnalyst(): boolean {
    return this.data.currentUserGlobalRole === UserRole.SYSTEM_ANALYST;
  }

  //роль вне разработки: процесс планирования/аналитики, а не работа с кодом
  isNonEngineeringRole(): boolean {
    return this.isProjectManager() || this.isSystemAnalyst();
  }

  //состояние и действия в задаче

  //мр существует без привязанной задачи (хотфикс)
  isStandaloneMergeRequest(): boolean {
    return (
      this.data.activityStream.issueState === null &&
      this.data.activityStream.mergeRequestState !== null
    );
  }

  //закрытие задачи — событие именно этого дня: либо закрыл сам, либо задача закрылась в этот день.
  //без такой проверки любой комментарий к давно закрытой задаче читался бы как «принял работу»
  isIssueClosedToday(): boolean {
    return (
      this.currentUserClosedIssue() ||
      this.data.activityStream.issueClosedOnReportDate
    );
  }

  //мр смерджен в день отчёта
  isMergeRequestMergedToday(): boolean {
    return (
      this.currentUserMergedMergeRequest() ||
      this.data.activityStream.mergeRequestMergedOnReportDate
    );
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

  //задача закрыта в день отчёта и мр смерджена
  isIssueClosedWithMerge(): boolean {
    return this.isIssueClosedToday() && this.isMergeRequestMerged();
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

  //задача помечена как хотфикс (лейбл type::hotfix)
  isHotfix(): boolean {
    return this.data.labels.types.includes(LabelType.HOTFIX);
  }

  //задача типа maintenance/chore
  isMaintenance(): boolean {
    return this.data.taskType === TaskType.CHORE;
  }

  //задача на e2e тесты (лейбл type::e2e)
  isE2E(): boolean {
    return this.data.labels.types.includes(LabelType.E2E);
  }

  //внутренняя задача qa: автотесты, тестовая инфраструктура, инструментарий (лейбл type::qa)
  isQaInternalTask(): boolean {
    return this.data.labels.types.includes(LabelType.QA);
  }

  //задача требует нового или обновлённого e2e-покрытия (лейбл test::e2e required)
  isE2ERequired(): boolean {
    return this.data.labels.testFlags.includes(LabelTest.E2E_REQUIRED);
  }

  //задача требует юнит-тестов (лейбл test::unit)
  isUnitTestRequired(): boolean {
    return this.data.labels.testFlags.includes(LabelTest.UNIT);
  }

  //эпик — крупная задача с подзадачами
  isEpic(): boolean {
    return this.data.labels.types.includes(LabelType.EPIC);
  }

  //задача так или иначе относится к e2e-покрытию
  needsE2ECoverage(): boolean {
    return this.isE2E() || this.isE2ERequired();
  }

  //приоритет

  //критический приоритет
  isCriticalPriority(): boolean {
    return this.data.labels.priorities.includes(LabelPriority.CRITICAL);
  }

  //задача срочная (приоритет critical/high + тип bug)
  isUrgentTask(): boolean {
    const hasHighPriority =
      this.data.labels.priorities.includes(LabelPriority.CRITICAL) ||
      this.data.labels.priorities.includes(LabelPriority.HIGH);
    return hasHighPriority && this.data.labels.types.includes(LabelType.BUG);
  }

  //текущий пользователь изменил приоритет на critical
  currentUserEscalatedPriority(): boolean {
    return this.data.labels.priorityChangedByCurrentUser;
  }

  //действия пользователя с кодом

  //текущий пользователь запушил код в мр
  currentUserPushedCode(): boolean {
    return this.data.activityStream.mergeRequestActions.some(
      (action) =>
        action === GitLabAction.PUSHED_TO || action === GitLabAction.PUSHED_NEW,
    );
  }

  //в коммитах за день есть работа над тестами
  hasTestRelatedCommits(): boolean {
    return this.data.activityStream.commitTitles.some((title) =>
      GIT_MAPPER_TEST_COMMIT_PATTERN.test(title),
    );
  }

  //пользователь разрабатывал e2e-покрытие: задача его требует, и в коммитах есть тесты
  //для qa любой пуш в такую задачу — работа над тестами, для остальных нужен явный признак
  isE2ECoverageWork(): boolean {
    if (!this.needsE2ECoverage() || !this.currentUserPushedCode()) return false;
    return this.isQualityAssurance() || this.hasTestRelatedCommits();
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

  //текущий пользователь — автор мр (открыл его в принципе, а не только в день отчёта)
  isMergeRequestAuthor(): boolean {
    return this.data.isMergeRequestAuthor;
  }

  //мр является «своим»: пользователь исполнитель либо автор мр.
  //нужно чтобы отличать мердж своей работы от мерджа чужой (ревьюер/мейнтейнер)
  isOwnMergeRequest(): boolean {
    return this.isAssignee() || this.isMergeRequestAuthor();
  }

  //есть рабочие события в мр за день (пуш, открытие), но не мердж
  hasActiveWorkOnMergeRequest(): boolean {
    return this.currentUserPushedCode() || this.currentUserOpenedMergeRequest();
  }

  //текущий пользователь создал задачу
  //gitlab шлёт opened для issue и created для work item — оба означают «завёл задачу»
  currentUserOpenedIssue(): boolean {
    return this.data.activityStream.issueActions.some(
      (action) =>
        action === GitLabAction.OPENED || action === GitLabAction.CREATED,
    );
  }

  //текущий пользователь закрыл задачу
  currentUserClosedIssue(): boolean {
    return this.data.activityStream.issueActions.includes(GitLabAction.CLOSED);
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

  //в мр есть замечания, оформленные тредами
  hasReviewThreads(): boolean {
    return this.data.activityStream.reviewThreadCount > 0;
  }

  //остались незакрытые замечания ревьюеров
  hasUnresolvedReviewThreads(): boolean {
    return this.data.activityStream.unresolvedReviewThreadCount > 0;
  }

  //много комментариев от текущего пользователя (блокирующее ревью)
  hasManyMergeRequestComments(): boolean {
    return (
      this.data.activityStream.mergeRequestCommentsFromCurrentUser >=
      GIT_MAPPER_MANY_COMMENTS_THRESHOLD
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

  //статус задачи (лейблы)
  //везде это состояние: лейбл висит на задаче либо был выставлен в день отчёта.
  //«кто и когда перевёл» — отдельные предикаты currentUser*

  //задача в статусе «в работе»
  isDoing(): boolean {
    return this.hasStatus(LabelStatus.DOING);
  }

  //задача в статусе «на ревью»
  isInReview(): boolean {
    return this.hasStatus(LabelStatus.REVIEW);
  }

  //задача в статусе «после ревью» (правки после замечаний)
  isAfterReview(): boolean {
    return this.hasStatus(LabelStatus.AFTER_REVIEW);
  }

  //задача в любой фазе ревью
  isInReviewPhase(): boolean {
    return this.isInReview() || this.isAfterReview();
  }

  //задача в статусе «тестирование» (старый status::testing либо status::QA in progress)
  isTesting(): boolean {
    return this.hasStatus(LabelStatus.TESTING) || this.isQaInProgress();
  }

  //задача в статусе «нужна информация»
  isNeedInformation(): boolean {
    return this.hasStatus(LabelStatus.NEED_INFORMATION);
  }

  //задача была в ревью/тестировании и вернулась в doing (возврат на доработку)
  wasReturnedToDoing(): boolean {
    const { previousStatus, currentStatus } = this.data.labels;
    return (
      currentStatus === LabelStatus.DOING &&
      (previousStatus === LabelStatus.REVIEW ||
        previousStatus === LabelStatus.TESTING ||
        previousStatus === LabelStatus.AFTER_REVIEW ||
        previousStatus === LabelStatus.QA_IN_PROGRESS ||
        previousStatus === LabelStatus.READY_FOR_QA)
    );
  }

  //qa-процесс по глобальным лейблам

  //задача ждёт тестирования (status::ready for QA)
  isReadyForQa(): boolean {
    return this.hasStatus(LabelStatus.READY_FOR_QA);
  }

  //задача на тестировании (status::QA in progress)
  isQaInProgress(): boolean {
    return this.hasStatus(LabelStatus.QA_IN_PROGRESS);
  }

  //задача возвращена с тестирования в разработку (qa::returned to development)
  isReturnedFromQa(): boolean {
    return this.data.labels.qaFlags.includes(LabelQa.RETURNED_TO_DEVELOPMENT);
  }

  //текущий пользователь передал задачу на тестирование
  currentUserMarkedReadyForQa(): boolean {
    return this.data.labels.statusLabelsSetByCurrentUser.includes(
      LabelStatus.READY_FOR_QA,
    );
  }

  //текущий пользователь взял задачу на тестирование
  currentUserStartedQaTesting(): boolean {
    return this.data.labels.statusLabelsSetByCurrentUser.includes(
      LabelStatus.QA_IN_PROGRESS,
    );
  }

  //текущий пользователь вернул задачу в разработку
  currentUserReturnedTaskToDevelopment(): boolean {
    return this.data.labels.qaFlagsSetByCurrentUser.includes(
      LabelQa.RETURNED_TO_DEVELOPMENT,
    );
  }

  //тестирование завершено успешно, замечаний нет (status::QA passed)
  isQaPassed(): boolean {
    return this.hasStatus(LabelStatus.QA_PASSED);
  }

  //задача перешла в «проверено» именно в день отчёта, а не висит в этом статусе давно
  isQaPassedToday(): boolean {
    return this.data.labels.currentStatus === LabelStatus.QA_PASSED;
  }

  //текущий пользователь подтвердил успешное прохождение тестирования
  currentUserMarkedQaPassed(): boolean {
    return this.data.labels.statusLabelsSetByCurrentUser.includes(
      LabelStatus.QA_PASSED,
    );
  }

  //задача так или иначе находится в контуре qa
  isInQaFlow(): boolean {
    return this.isReadyForQa() || this.isQaInProgress() || this.isQaPassed();
  }

  //прочие статусы процесса

  //задача отложена (status::hold)
  isOnHold(): boolean {
    return this.hasStatus(LabelStatus.HOLD);
  }

  //текущий пользователь отложил задачу
  currentUserPutOnHold(): boolean {
    return this.data.labels.statusLabelsSetByCurrentUser.includes(
      LabelStatus.HOLD,
    );
  }

  //текущий пользователь взял задачу в план (status::todo / status::sprint backlog)
  currentUserPlannedTask(): boolean {
    const planned = this.data.labels.statusLabelsSetByCurrentUser;
    return (
      planned.includes(LabelStatus.TODO) ||
      planned.includes(LabelStatus.SPRINT_BACKLOG)
    );
  }

  //ветка отставала от целевой, но лейбл needs-rebase сняли в день отчёта
  currentUserResolvedRebase(): boolean {
    return this.data.labels.needsRebaseResolved && this.currentUserPushedCode();
  }

  //статус выставлен за день отчёта либо висит на задаче сейчас
  private hasStatus(status: LabelStatus): boolean {
    return (
      this.data.labels.currentStatus === status ||
      this.data.labels.activeStatuses.includes(status)
    );
  }

  //лейблы (действия пользователя)

  //текущий пользователь отправил задачу на ревью
  currentUserSentToReview(): boolean {
    return this.data.labels.statusLabelsSetByCurrentUser.includes(
      LabelStatus.REVIEW,
    );
  }

  //текущий пользователь запросил дополнительную информацию
  currentUserRequestedInformation(): boolean {
    return this.data.labels.statusLabelsSetByCurrentUser.includes(
      LabelStatus.NEED_INFORMATION,
    );
  }

  //текущий пользователь передал задачу на фронтенд
  currentUserPassedToFrontend(): boolean {
    return this.data.labels.statusLabelsSetByCurrentUser.includes(
      LabelStatus.FRONTEND,
    );
  }

  //текущий пользователь перевел задачу в тестирование
  currentUserSentToTesting(): boolean {
    return this.data.labels.statusLabelsSetByCurrentUser.includes(
      LabelStatus.TESTING,
    );
  }

  //текущий пользователь вернул задачу в doing
  currentUserReturnedToDoing(): boolean {
    return this.data.labels.statusLabelsSetByCurrentUser.includes(
      LabelStatus.DOING,
    );
  }

  //даты

  //мр создан в день отчета (не раньше)
  isMergeRequestCreatedOnReportDate(): boolean {
    const createdAt = this.data.taskDates.mergeRequestCreatedAt;
    if (!createdAt) return false;

    const reportDay = this.data.taskDates.reportDate.slice(0, 10);
    const createdDay = createdAt.slice(0, 10);
    return reportDay === createdDay;
  }

  //работа возобновлена: последний коммит был более N дней назад
  isResumedWork(): boolean {
    const lastCommitAt = this.data.taskDates.mergeRequestLastCommitAt;
    if (!lastCommitAt) return false;

    const daysSinceLastCommit =
      (new Date(this.data.taskDates.reportDate).getTime() -
        new Date(lastCommitAt).getTime()) /
      (1000 * 60 * 60 * 24);

    return daysSinceLastCommit > GIT_MAPPER_DAYS_THRESHOLD_RESUMED_WORK;
  }

  //текущий пользователь переоткрыл задачу
  currentUserReopenedIssue(): boolean {
    return this.data.activityStream.issueActions.includes(
      GitLabAction.REOPENED,
    );
  }

  //задача закрыта в день отчёта без мерджа (отменена, невалидна и т.д.)
  isClosedWithoutMerge(): boolean {
    return (
      this.isIssueClosedToday() &&
      (!this.hasMergeRequest() || !this.isMergeRequestMerged())
    );
  }

  //степень вовлечённости

  //рассчитывает (и кэширует) степень вовлечённости пользователя в задачу
  private resolveEngagement(): EngagementResult {
    if (this.engagementCache) return this.engagementCache;

    this.engagementCache = calculateEngagement({
      isAssignee: this.isAssignee(),
      isReviewer: this.isReviewer(),
      isIssueAuthor: this.currentUserOpenedIssue(),
      isMergeRequestAuthor: this.isMergeRequestAuthor(),
      mergedMergeRequest: this.currentUserMergedMergeRequest(),
      commitCount: this.data.activityStream.mergeRequestCommitCount,
      commentCount:
        this.data.activityStream.issueCommentsFromCurrentUser +
        this.data.activityStream.mergeRequestCommentsFromCurrentUser,
      statusChangesCount: this.data.labels.statusLabelsSetByCurrentUser.length,
      escalatedPriority: this.data.labels.priorityChangedByCurrentUser,
    });

    return this.engagementCache;
  }

  //уровень вовлечённости
  engagementLevel(): EngagementLevel {
    return this.resolveEngagement().level;
  }

  //значимый соучастник (но не основной)
  isSecondaryContributor(): boolean {
    return this.engagementLevel() === EngagementLevel.SECONDARY;
  }

  //незначительное участие
  isMinorContributor(): boolean {
    return this.engagementLevel() === EngagementLevel.MINOR;
  }

  //внёс вклад в чужую задачу, не будучи её основным исполнителем
  //уровни вовлечённости взаимоисключающие, поэтому достаточно проверить два нижних
  isSupportingContributor(): boolean {
    return (
      !this.isAssignee() &&
      (this.isSecondaryContributor() || this.isMinorContributor())
    );
  }
}
