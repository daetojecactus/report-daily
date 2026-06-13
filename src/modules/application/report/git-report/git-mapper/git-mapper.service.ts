import { Injectable } from '@nestjs/common';
import {
  CleanEvent,
  CleanLabelEvent,
  CleanNote,
  GroupedDailyData,
  GroupedIssue,
  StandaloneMergeRequest,
  StandalonePush,
} from '../git-group/git-group.interface';
import { TaskRole, MappedDailyData } from './git-mapper.interface';
import { TaskContext } from './git-mapper.context';
import { TaskStatus, TaskType } from 'src/common/enums/task.enum';
import {
  LabelType,
  LabelPriority,
  LabelStatus,
} from 'src/common/enums/label.enum';
import { GitLabAction } from 'src/common/enums/gitlab.enum';
import { UserRole } from 'src/modules/application/user/user.interface';

@Injectable()
export class GitMapperService {
  mapDailyData(
    data: GroupedDailyData,
    username: string,
    currentUserGlobalRole: UserRole,
    reportDate: string,
  ): MappedDailyData {
    return {
      issues: data.issues.map((issue) => {
        const context = this.buildIssueContext(
          issue,
          username,
          currentUserGlobalRole,
          reportDate,
        );
        return {
          ...issue,
          workResult: {
            status: this.determineTaskStatus(context),
            taskType: context.taskType,
          },
        };
      }),
      standaloneMergeRequests: data.standaloneMergeRequests.map(
        (mergeRequest) => {
          const context = this.buildStandaloneMergeRequestContext(
            mergeRequest,
            username,
            currentUserGlobalRole,
            reportDate,
          );
          return {
            ...mergeRequest,
            workResult: {
              status: this.determineTaskStatus(context),
              taskType: context.taskType,
            },
          };
        },
      ),
      standalonePushes: data.standalonePushes.map((push) => ({
        ...push,
        workResult: {
          status: this.isNewBranch(push)
            ? TaskStatus.STARTED
            : TaskStatus.CONTINUED,
          taskType: TaskType.UNKNOWN,
        },
      })),
    };
  }

  //определение статуса по роли
  determineTaskStatus(context: TaskContext): TaskStatus {
    //стезя qa
    if (context.isQualityAssurance()) {
      return this.determineForQA(context);
    }

    //стезя pm
    if (context.isProjectManager()) {
      return this.determineForPM(context);
    }

    //стезя developer и admin
    return this.determineForDeveloper(context);
  }

  //определяем для qa
  private determineForQA(context: TaskContext): TaskStatus {
    //qa как ревьюер
    if (context.isReviewer()) {
      return this.determineForQAReviewer(context);
    }

    //qa не ревьюер
    return this.determineForQAWorker(context);
  }

  //qa как ревьюер
  private determineForQAReviewer(context: TaskContext): TaskStatus {
    //закрыл задачу и принял исправление
    if (context.currentUserClosedIssue() || context.isIssueClosed()) {
      return TaskStatus.VERIFIED_FIX;
    }

    //переоткрыл баг
    if (context.currentUserReopenedIssue() && context.isBug()) {
      return TaskStatus.REOPENED_BUG;
    }

    //переоткрыл задачу
    if (context.currentUserReopenedIssue()) {
      return TaskStatus.REOPENED;
    }

    //заблокировал релиз — эскалация критического бага при тестировании
    if (
      context.currentUserEscalatedPriority() &&
      context.isBug() &&
      context.isTesting()
    ) {
      return TaskStatus.BLOCKED_RELEASE;
    }

    //апрувнул после доработок
    if (context.currentUserApproved() && context.isAfterReview()) {
      return TaskStatus.APPROVED_AFTER_REWORK;
    }

    //протестировал и апрувнул
    if (context.currentUserApproved()) {
      return TaskStatus.TESTED_AND_APPROVED;
    }

    //вернул задачу на доработку
    if (context.currentUserReturnedToDoing() && context.wasReturnedToDoing()) {
      return TaskStatus.RETURNED_FOR_REVISION;
    }

    //начал тестирование
    if (context.currentUserSentToTesting()) {
      return TaskStatus.STARTED_TESTING;
    }

    //провел тестирование и оставил замечания
    if (
      context.currentUserCommentedOnMergeRequest() &&
      context.hasManyMergeRequestComments() &&
      !context.currentUserApproved()
    ) {
      return TaskStatus.TESTED_WITH_COMMENTS;
    }

    //уточнил детали бага
    if (
      context.currentUserCommentedOnIssue() &&
      (context.isDoing() || context.isNeedInformation()) &&
      context.isBug()
    ) {
      return TaskStatus.CLARIFIED_BUG;
    }

    //оставил комментарий к мр
    if (context.currentUserCommentedOnMergeRequest()) {
      return TaskStatus.REVIEW_COMMENT;
    }

    //прокомментировал задачу
    if (context.currentUserCommentedAnywhere()) {
      return TaskStatus.COMMENTED;
    }

    return TaskStatus.UNKNOWN;
  }

  //qa не ревьюер
  private determineForQAWorker(context: TaskContext): TaskStatus {
    //закрыл задачу и принял исправление
    if (context.currentUserClosedIssue() || context.isIssueClosed()) {
      return TaskStatus.VERIFIED_FIX;
    }

    //переоткрыл баг
    if (context.currentUserReopenedIssue() && context.isBug()) {
      return TaskStatus.REOPENED_BUG;
    }

    //переоткрыл задачу
    if (context.currentUserReopenedIssue()) {
      return TaskStatus.REOPENED;
    }

    //нашел регрессию — создал баг, пока задача в тестировании
    if (
      context.currentUserOpenedIssue() &&
      context.isBug() &&
      context.isTesting()
    ) {
      return TaskStatus.REGRESSION_FOUND;
    }

    //создал баг-репорт
    if (context.currentUserOpenedIssue() && context.isBug()) {
      return TaskStatus.FOUND_BUG;
    }

    //создал задачу
    if (context.currentUserOpenedIssue()) {
      return TaskStatus.CREATED_TASK;
    }

    //заблокировал релиз — эскалация критического бага
    if (
      context.currentUserEscalatedPriority() &&
      context.isBug() &&
      context.isTesting()
    ) {
      return TaskStatus.BLOCKED_RELEASE;
    }

    //пуш + e2e задача
    if (context.currentUserPushedCode() && context.isE2E()) {
      return TaskStatus.WROTE_TESTS;
    }

    //отдал на ревью
    if (context.currentUserSentToReview()) {
      return TaskStatus.SENT_TO_REVIEW;
    }

    //пуш + after_review
    if (context.currentUserPushedCode() && context.isAfterReview()) {
      return TaskStatus.CORRECTED_AFTER_REVIEW;
    }

    //пуш + мр создана сегодня
    if (
      context.currentUserPushedCode() &&
      context.isMergeRequestCreatedOnReportDate()
    ) {
      return TaskStatus.STARTED_IMPLEMENTATION;
    }

    //пуш в мр
    if (context.currentUserPushedCode() && context.hasMergeRequest()) {
      return TaskStatus.WROTE_CODE;
    }

    //уточнил детали бага
    if (
      context.currentUserCommentedOnIssue() &&
      (context.isDoing() || context.isNeedInformation()) &&
      context.isBug()
    ) {
      return TaskStatus.CLARIFIED_BUG;
    }

    //прокомментировал задачу
    if (context.currentUserCommentedAnywhere()) {
      return TaskStatus.COMMENTED;
    }

    //дальше как разработчик (мр, статусы, fallback)
    return this.determineForDeveloperAssignee(context);
  }

  //pm
  private determineForPM(context: TaskContext): TaskStatus {
    //проверил и закрыл фичу
    if (
      (context.currentUserClosedIssue() || context.isIssueClosed()) &&
      context.isFeature()
    ) {
      return TaskStatus.REVIEWED_AND_CLOSED;
    }

    //закрыл задачу
    if (context.currentUserClosedIssue() || context.isIssueClosed()) {
      return TaskStatus.ACCEPTED_WORK;
    }

    //переоткрыл задачу
    if (context.currentUserReopenedIssue()) {
      return TaskStatus.REOPENED;
    }

    //запланировал фичу
    if (context.currentUserOpenedIssue() && context.isFeature()) {
      return TaskStatus.PLANNED_FEATURE;
    }

    //сообщил о баге
    if (context.currentUserOpenedIssue() && context.isBug()) {
      return TaskStatus.REPORTED_BUG;
    }

    //создал задачу
    if (context.currentUserOpenedIssue()) {
      return TaskStatus.CREATED;
    }

    //повысил приоритет задачи
    if (context.currentUserEscalatedPriority()) {
      return TaskStatus.ESCALATED_PRIORITY;
    }

    //назначил задачу в работу
    if (context.currentUserReturnedToDoing() || context.isDoing()) {
      if (context.currentUserCommentedAnywhere()) {
        return TaskStatus.DELEGATED_TASK;
      }
    }

    //предоставил требования
    if (context.currentUserCommentedAnywhere() && context.isNeedInformation()) {
      return TaskStatus.PROVIDED_REQUIREMENTS;
    }

    //прокомментировал задачу
    if (context.currentUserCommentedAnywhere()) {
      return TaskStatus.COMMENTED;
    }

    return TaskStatus.UNKNOWN;
  }

  //developer/admin
  private determineForDeveloper(context: TaskContext): TaskStatus {
    //ревьюер проверяет чужой код
    if (context.isReviewer()) {
      return this.determineForDeveloperReviewer(context);
    }

    //автор задачи, но не исполнитель
    if (context.isAuthor()) {
      return this.determineForDeveloperAuthor(context);
    }

    //исполнитель или наблюдатель
    return this.determineForDeveloperAssignee(context);
  }

  //developer/admin как исполнитель
  private determineForDeveloperAssignee(context: TaskContext): TaskStatus {
    //только мр + критический баг → деплой на прод
    if (
      context.isStandaloneMergeRequest() &&
      context.isUrgentTask() &&
      context.currentUserMergedMergeRequest()
    ) {
      return TaskStatus.DEPLOYED_TO_PRODUCTION;
    }

    //только мр + критический приоритет + мердж → хотфикс
    if (
      context.isStandaloneMergeRequest() &&
      context.currentUserMergedMergeRequest() &&
      context.isCriticalPriority()
    ) {
      return TaskStatus.HOTFIX_DEPLOYED;
    }

    //только мр + мердж
    if (
      context.isStandaloneMergeRequest() &&
      context.currentUserMergedMergeRequest()
    ) {
      return context.isBug()
        ? TaskStatus.FIXED_BUG
        : TaskStatus.COMPLETED_BY_MERGE;
    }

    //смерджил мр + критический приоритет + баг → деплой
    if (
      context.currentUserMergedMergeRequest() &&
      context.isCriticalPriority() &&
      context.isBug()
    ) {
      return TaskStatus.DEPLOYED_TO_PRODUCTION;
    }

    //смерджил мр + баг
    if (context.currentUserMergedMergeRequest() && context.isBug()) {
      return TaskStatus.FIXED_BUG;
    }

    //смерджил мр + фича
    if (context.currentUserMergedMergeRequest() && context.isFeature()) {
      return TaskStatus.IMPLEMENTED_FEATURE;
    }

    //смерджил мр
    if (context.currentUserMergedMergeRequest()) {
      return TaskStatus.COMPLETED_BY_MERGE;
    }

    //задача закрыта с мерджем (но мерджил не я)
    if (context.isIssueClosedWithMerge() && context.isAssignee()) {
      return TaskStatus.COMPLETED_BY_MERGE;
    }

    //задача закрыта без мерджа
    if (context.isClosedWithoutMerge() && context.isAssignee()) {
      return TaskStatus.CLOSED_WITHOUT_MERGE;
    }

    //переоткрыл задачу
    if (context.currentUserReopenedIssue()) {
      return TaskStatus.REOPENED;
    }

    //отдал на ревью
    if (context.currentUserSentToReview()) {
      return TaskStatus.SENT_TO_REVIEW;
    }

    //получил апрув (прошёл ревью)
    if (context.isApprovedByOtherUsers() && context.isAssignee()) {
      return TaskStatus.PASSED_REVIEW;
    }

    //запросил информацию
    if (context.currentUserRequestedInformation()) {
      return TaskStatus.NEED_INFORMATION;
    }

    //передал на фронтенд
    if (context.currentUserPassedToFrontend()) {
      return TaskStatus.PASSED_TO_FRONTEND;
    }

    //устранил замечания ревьюера (пуш + диалог в мр)
    if (
      context.currentUserPushedCode() &&
      context.hasReviewDialog() &&
      context.isAssignee()
    ) {
      return TaskStatus.RESOLVED_REVIEW_COMMENTS;
    }

    //вторичный участник: внёс код в чужую задачу, но не её основной исполнитель
    //(например, один-два коммита — это не «возобновил работу»)
    if (context.currentUserPushedCode() && context.isSupportingContributor()) {
      //писал код и параллельно вёл диалог в мр — совместная работа
      if (context.hasReviewDialog()) {
        return TaskStatus.PAIRED_ON_TASK;
      }
      //помощь именно с багом
      if (context.isBug()) {
        return TaskStatus.HELPED_RESOLVE_BUG;
      }
      //значимый вклад vs незначительный
      return context.isSecondaryContributor()
        ? TaskStatus.CONTRIBUTED_CODE
        : TaskStatus.HELPED_WITH_TASK;
    }

    //пуш в статусе after_review
    if (context.currentUserPushedCode() && context.isAfterReview()) {
      return TaskStatus.CORRECTED_AFTER_REVIEW;
    }

    //рефакторинг — maintenance + пуш
    if (context.currentUserPushedCode() && context.isMaintenance()) {
      return TaskStatus.REFACTORED_CODE;
    }

    //возобновил работу — старая мр (7+ дней) + пуш
    if (context.currentUserPushedCode() && context.isResumedWork()) {
      return TaskStatus.RESUMED_WORK;
    }

    //пуш + мр создана сегодня
    if (
      context.currentUserPushedCode() &&
      context.isMergeRequestCreatedOnReportDate()
    ) {
      return TaskStatus.STARTED_IMPLEMENTATION;
    }

    //пуш в мр
    if (context.currentUserPushedCode() && context.hasMergeRequest()) {
      return TaskStatus.WROTE_CODE;
    }

    //мр создана сегодня
    if (
      context.isAssignee() &&
      context.hasMergeRequest() &&
      context.isMergeRequestCreatedOnReportDate()
    ) {
      return TaskStatus.STARTED_IMPLEMENTATION;
    }

    //ответил на комментарий ревьюера
    if (context.hasReviewDialog() && context.isAssignee()) {
      return TaskStatus.DISCUSSED_CODE;
    }

    //создал задачу
    if (context.currentUserOpenedIssue()) {
      return TaskStatus.CREATED;
    }

    //создал проект
    if (context.currentUserCreatedProject()) {
      return TaskStatus.CREATED_PROJECT;
    }

    //комментировал, но нет активной работы с кодом
    if (
      context.isAssignee() &&
      context.currentUserCommentedAnywhere() &&
      !context.hasActiveWorkOnMergeRequest()
    ) {
      return TaskStatus.COMMENTED;
    }

    //задача в doing
    if (context.isAssignee() && context.isDoing()) {
      return TaskStatus.CONTINUED;
    }

    //задача в review
    if (context.isAssignee() && context.isInReview()) {
      return TaskStatus.SENT_TO_REVIEW;
    }

    //задача в after_review
    if (context.isAssignee() && context.isAfterReview()) {
      return TaskStatus.CORRECTED_AFTER_REVIEW;
    }

    //задача с мр (fallback)
    if (context.isAssignee() && context.hasMergeRequest()) {
      return TaskStatus.CONTINUED;
    }

    //standalone мр без мерджа
    if (context.isStandaloneMergeRequest()) {
      return context.currentUserPushedCode()
        ? TaskStatus.WROTE_CODE
        : TaskStatus.CONTINUED;
    }

    //observer комментировал и задача закрыта/смерджена (участвовал в закрытии)
    if (
      context.isObserver() &&
      context.currentUserCommentedAnywhere() &&
      (context.isIssueClosed() || context.isMergeRequestMerged())
    ) {
      return TaskStatus.PARTICIPATED_IN_CLOSURE;
    }

    //вторичный участник оставил замечания по чужому мр (неформальное ревью)
    if (
      !context.isAssignee() &&
      context.currentUserCommentedOnMergeRequest() &&
      !context.hasActiveWorkOnMergeRequest()
    ) {
      //значимое участие → помог с ревью, иначе → лёгкая подсказка
      return context.isSecondaryContributor()
        ? TaskStatus.ASSISTED_REVIEW
        : TaskStatus.LEFT_SUGGESTION;
    }

    //просто комменты
    if (context.currentUserCommentedAnywhere()) {
      return TaskStatus.COMMENTED;
    }

    return TaskStatus.UNKNOWN;
  }

  //developer/admin (reviewer)
  private determineForDeveloperReviewer(context: TaskContext): TaskStatus {
    //апрувнул и смерджил (комбо)
    if (
      context.currentUserApproved() &&
      context.currentUserMergedMergeRequest()
    ) {
      return TaskStatus.APPROVED_AND_MERGED;
    }

    //повторно проверил и одобрил (after_review + апрув)
    if (context.currentUserApproved() && context.isAfterReview()) {
      return TaskStatus.RE_REVIEWED_AND_APPROVED;
    }

    //апрув после правок
    if (context.currentUserApproved() && context.wasReturnedToDoing()) {
      return TaskStatus.APPROVED_FIXES;
    }

    //ревьюер смерджил чужую задачу (без апрува)
    if (context.currentUserMergedMergeRequest()) {
      return TaskStatus.MERGED_OTHERS_WORK;
    }

    //апрув
    if (context.currentUserApproved()) {
      return TaskStatus.APPROVED_MR;
    }

    //много комментариев без апрува
    if (
      context.currentUserCommentedOnMergeRequest() &&
      context.hasManyMergeRequestComments() &&
      !context.currentUserApproved()
    ) {
      return TaskStatus.REQUESTED_CHANGES;
    }

    //мало комментариев (вопросы по коду)
    if (context.currentUserCommentedOnMergeRequest()) {
      return TaskStatus.REVIEW_COMMENT;
    }

    //вернул задачу на доработку
    if (context.currentUserReturnedToDoing() && context.wasReturnedToDoing()) {
      return TaskStatus.RETURNED_FOR_REVISION;
    }

    //комментарий к задаче
    if (context.currentUserCommentedOnIssue()) {
      return TaskStatus.COMMENTED;
    }

    //есть мр, но ревьюер не оставил действий — назначен ревьюером, взял в ревью
    if (context.hasMergeRequest()) {
      return TaskStatus.STARTED_REVIEW;
    }

    return TaskStatus.UNKNOWN;
  }

  //developer/admin (author)
  private determineForDeveloperAuthor(context: TaskContext): TaskStatus {
    //принял результат (задача закрыта/смерджена)
    if (context.isIssueClosedWithMerge() || context.isIssueClosed()) {
      return TaskStatus.ACCEPTED_RESULT;
    }

    //переоткрыл задачу
    if (context.currentUserReopenedIssue()) {
      return TaskStatus.REOPENED;
    }

    //смерджил чужую работу
    if (context.currentUserMergedMergeRequest()) {
      return TaskStatus.MERGED_OTHERS_WORK;
    }

    //создал тех. долг
    if (context.currentUserOpenedIssue() && context.isMaintenance()) {
      return TaskStatus.CREATED_TECH_DEBT;
    }

    //нашел баг при работе
    if (context.currentUserOpenedIssue() && context.isBug()) {
      return TaskStatus.FOUND_BUG_DURING_WORK;
    }

    //создал задачу (фича или прочее)
    if (context.currentUserOpenedIssue()) {
      return TaskStatus.CREATED;
    }

    //комментарий
    if (context.currentUserCommentedAnywhere()) {
      return TaskStatus.COMMENTED;
    }

    return TaskStatus.UNKNOWN;
  }

  //построение контекста

  //построение контекста для задачи (issue)
  private buildIssueContext(
    issue: GroupedIssue,
    username: string,
    currentUserGlobalRole: UserRole,
    reportDate: string,
  ): TaskContext {
    const mergeRequest = issue.mergeRequests[0] ?? null;
    const mergeRequestNotes = mergeRequest?.notes ?? [];
    const mergeRequestEvents = mergeRequest?.events ?? [];

    return new TaskContext({
      currentUserGlobalRole,
      userRoleInTask: this.resolveTaskRole(
        issue.assignee,
        mergeRequest?.reviewers ?? [],
        username,
        issue.events,
      ),
      taskType: this.resolveTaskType(issue.labels),
      taskDates: {
        issueCreatedAt: issue.createdAt,
        mergeRequestCreatedAt: mergeRequest?.createdAt ?? null,
        reportDate,
      },
      labels: {
        priorities: this.parseLabelPriorities(issue.labels),
        types: this.parseLabelTypes(issue.labels),
        currentStatus: this.resolveCurrentStatusLabel(issue.labelEvents),
        previousStatus: this.resolvePreviousStatusLabel(issue.labelEvents),
        statusLabelsSetByCurrentUser: this.resolveStatusLabelsSetByUser(
          issue.labelEvents,
          username,
        ),
        priorityChangedByCurrentUser: this.hasPriorityEscalation(
          issue.labelEvents,
          username,
        ),
      },
      activityStream: {
        issueState: issue.state,
        mergeRequestState: mergeRequest?.state ?? null,
        issueActions: issue.events.map(
          (event) => event.actionName as GitLabAction,
        ),
        mergeRequestActions: mergeRequestEvents.map(
          (event) => event.actionName as GitLabAction,
        ),
        issueCommentsFromCurrentUser: this.countUserComments(
          issue.notes,
          username,
        ),
        mergeRequestCommentsFromCurrentUser: this.countUserComments(
          mergeRequestNotes,
          username,
        ),
        mergeRequestCommentsFromOthers: this.countOtherComments(
          mergeRequestNotes,
          username,
        ),
        mergeRequestCommitCount: this.countCommits(mergeRequestEvents),
      },
      approvals: {
        currentUserApproved: mergeRequestEvents.some(
          (event) => event.actionName === GitLabAction.APPROVED,
        ),
        otherApprovers: this.extractOtherApprovers(mergeRequestNotes, username),
      },
    });
  }

  //построение контекста для standalone мр
  private buildStandaloneMergeRequestContext(
    mergeRequest: StandaloneMergeRequest,
    username: string,
    currentUserGlobalRole: UserRole,
    reportDate: string,
  ): TaskContext {
    return new TaskContext({
      currentUserGlobalRole,
      userRoleInTask: this.resolveTaskRole(
        mergeRequest.assignee,
        mergeRequest.reviewers,
        username,
        mergeRequest.events,
      ),
      taskType: this.resolveTaskType(mergeRequest.labels),
      taskDates: {
        issueCreatedAt: null,
        mergeRequestCreatedAt: mergeRequest.createdAt,
        reportDate,
      },
      labels: {
        priorities: this.parseLabelPriorities(mergeRequest.labels),
        types: this.parseLabelTypes(mergeRequest.labels),
        currentStatus: null,
        previousStatus: null,
        statusLabelsSetByCurrentUser: [],
        priorityChangedByCurrentUser: false,
      },
      activityStream: {
        issueState: null,
        mergeRequestState: mergeRequest.state,
        issueActions: [],
        mergeRequestActions: mergeRequest.events.map(
          (event) => event.actionName as GitLabAction,
        ),
        issueCommentsFromCurrentUser: 0,
        mergeRequestCommentsFromCurrentUser: this.countUserComments(
          mergeRequest.notes,
          username,
        ),
        mergeRequestCommentsFromOthers: this.countOtherComments(
          mergeRequest.notes,
          username,
        ),
        mergeRequestCommitCount: this.countCommits(mergeRequest.events),
      },
      approvals: {
        currentUserApproved: mergeRequest.events.some(
          (event) => event.actionName === GitLabAction.APPROVED,
        ),
        otherApprovers: this.extractOtherApprovers(
          mergeRequest.notes,
          username,
        ),
      },
    });
  }

  //тип задачи по лейблам
  private resolveTaskType(labels: string[]): TaskType {
    const values = this.extractLabelValues(labels);
    if (values.includes(LabelType.BUG)) return TaskType.BUG;
    if (values.includes(LabelType.FEATURE)) return TaskType.FEATURE;
    if (values.includes(LabelType.MAINTENANCE)) return TaskType.CHORE;
    return TaskType.UNKNOWN;
  }

  //роль пользователя в задаче
  //учитывает: assignee, reviewer, а также автор (создатель issue)
  private resolveTaskRole(
    assignee: string | null,
    reviewers: string[],
    username: string,
    events: { actionName: string }[],
  ): TaskRole {
    if (assignee === username) return TaskRole.ASSIGNEE;
    if (reviewers.includes(username)) return TaskRole.REVIEWER;

    //если пользователь создал задачу, но не assignee и не reviewer → автор
    const isIssueCreator = events.some(
      (event) =>
        event.actionName === GitLabAction.OPENED ||
        event.actionName === GitLabAction.CREATED,
    );
    if (isIssueCreator) return TaskRole.AUTHOR;

    return TaskRole.OBSERVER;
  }

  //лейблы приоритета из сырых лейблов
  private parseLabelPriorities(labels: string[]): LabelPriority[] {
    const values = this.extractLabelValues(labels);
    return Object.values(LabelPriority).filter((priority) =>
      values.includes(priority),
    );
  }

  //лейблы типа из сырых лейблов
  private parseLabelTypes(labels: string[]): LabelType[] {
    const values = this.extractLabelValues(labels);
    return Object.values(LabelType).filter((type) => values.includes(type));
  }

  //последний актуальный статус-лейбл
  private resolveCurrentStatusLabel(
    labelEvents: CleanLabelEvent[],
  ): LabelStatus | null {
    const statusLabelValues = Object.values(LabelStatus) as string[];

    const lastStatusEvent = [...labelEvents]
      .filter(
        (event) =>
          event.action === 'add' &&
          statusLabelValues.includes(this.extractLabelValue(event.labelName)),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];

    return lastStatusEvent
      ? (this.extractLabelValue(lastStatusEvent.labelName) as LabelStatus)
      : null;
  }

  //предпоследний статус-лейбл (для определения перехода, например review → doing)
  private resolvePreviousStatusLabel(
    labelEvents: CleanLabelEvent[],
  ): LabelStatus | null {
    const statusLabelValues = Object.values(LabelStatus) as string[];

    const sortedStatusEvents = [...labelEvents]
      .filter(
        (event) =>
          event.action === 'add' &&
          statusLabelValues.includes(this.extractLabelValue(event.labelName)),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    //второй по хронологии (предыдущий)
    const previousEvent = sortedStatusEvents[1];
    return previousEvent
      ? (this.extractLabelValue(previousEvent.labelName) as LabelStatus)
      : null;
  }

  //все статус-лейблы, поставленные конкретным пользователем
  private resolveStatusLabelsSetByUser(
    labelEvents: CleanLabelEvent[],
    username: string,
  ): LabelStatus[] {
    const statusLabelValues = Object.values(LabelStatus) as string[];

    return labelEvents
      .filter(
        (event) =>
          event.action === 'add' &&
          event.username === username &&
          statusLabelValues.includes(this.extractLabelValue(event.labelName)),
      )
      .map((event) => this.extractLabelValue(event.labelName) as LabelStatus);
  }

  //проверяет, повысил ли пользователь приоритет до critical
  private hasPriorityEscalation(
    labelEvents: CleanLabelEvent[],
    username: string,
  ): boolean {
    return labelEvents.some(
      (event) =>
        event.action === 'add' &&
        event.username === username &&
        this.extractLabelValue(event.labelName) === LabelPriority.CRITICAL,
    );
  }

  //количество НЕ системных комментариев пользователя
  private countUserComments(notes: CleanNote[], username: string): number {
    return notes.filter(
      (note) => note.authorUsername === username && !note.system,
    ).length;
  }

  //количество НЕ системных комментариев от других пользователей
  private countOtherComments(notes: CleanNote[], username: string): number {
    return notes.filter(
      (note) => note.authorUsername !== username && !note.system,
    ).length;
  }

  //суммарное количество коммитов из push-событий
  private countCommits(events: CleanEvent[]): number {
    return events.reduce(
      (total, event) => total + (event.pushData?.commitCount ?? 0),
      0,
    );
  }

  //usernames пользователей, которые апрувнули (кроме текущего)
  private extractOtherApprovers(
    notes: CleanNote[],
    username: string,
  ): string[] {
    const approvers = notes
      .filter(
        (note) =>
          note.system &&
          note.authorUsername !== username &&
          note.body.toLowerCase().includes('approved'),
      )
      .map((note) => note.authorUsername);

    return [...new Set(approvers)];
  }

  //проверяет что пуш создал новую ветку
  private isNewBranch(push: StandalonePush): boolean {
    return push.events.some(
      (event) =>
        event.pushData?.action === 'created' &&
        event.pushData?.refType === 'branch',
    );
  }

  //извлекает значение из scoped лейбла (status::doing → doing)
  private extractLabelValue(label: string): string {
    const parts = label.toLowerCase().split('::');
    return parts[parts.length - 1];
  }

  //извлекает значения из всех лейблов
  private extractLabelValues(labels: string[]): string[] {
    return labels.map((label) => this.extractLabelValue(label));
  }
}
