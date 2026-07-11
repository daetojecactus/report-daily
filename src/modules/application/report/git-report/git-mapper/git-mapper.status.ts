import { Injectable } from '@nestjs/common';
import { TaskContext } from './git-mapper.context';
import { TaskStatus } from 'src/common/enums/task.enum';

//rule engine: определяет статус задачи по контексту и роли пользователя
@Injectable()
export class GitMapperStatusResolver {
  //определение статуса по роли
  resolve(context: TaskContext): TaskStatus {
    //стезя pm — свой процесс (планирование/приёмка), мердж кода для него нетипичен
    if (context.isProjectManager()) {
      return this.determineForPM(context);
    }

    //мердж — всегда финальное и наивысшее по приоритету действие.
    //определяем его до ролевых веток, чтобы верно отличать свою работу от чужой
    if (context.currentUserMergedMergeRequest()) {
      return this.determineMergeStatus(context);
    }

    //стезя qa
    if (context.isQualityAssurance()) {
      return this.determineForQA(context);
    }

    //стезя developer и admin
    return this.determineForDeveloper(context);
  }

  //мердж мр — единая точка определения (приоритетнее любых других действий)
  private determineMergeStatus(context: TaskContext): TaskStatus {
    //мердж чужой работы: пользователь не исполнитель и не автор мр (ревьюер/мейнтейнер)
    if (!context.isOwnMergeRequest()) {
      //одобрил и сразу смерджил
      if (context.currentUserApproved()) {
        return TaskStatus.APPROVED_AND_MERGED;
      }
      return TaskStatus.MERGED_OTHERS_WORK;
    }

    //дальше — мердж своей работы

    //отдельный мр без задачи (хотфикс): срочный баг → деплой на прод
    if (context.isStandaloneMergeRequest() && context.isUrgentTask()) {
      return TaskStatus.DEPLOYED_TO_PRODUCTION;
    }

    //отдельный мр без задачи + критический приоритет → хотфикс
    if (context.isStandaloneMergeRequest() && context.isCriticalPriority()) {
      return TaskStatus.HOTFIX_DEPLOYED;
    }

    //критический баг → деплой на прод
    if (context.isCriticalPriority() && context.isBug()) {
      return TaskStatus.DEPLOYED_TO_PRODUCTION;
    }

    //свой мердж по типу задачи
    if (context.isBug()) return TaskStatus.FIXED_BUG;
    if (context.isFeature()) return TaskStatus.IMPLEMENTED_FEATURE;
    return TaskStatus.COMPLETED_BY_MERGE;
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
  //мердж (свой/чужой) обрабатывается в determineMergeStatus до вызова этой ветки
  private determineForDeveloperAssignee(context: TaskContext): TaskStatus {
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
  //мердж обрабатывается в determineMergeStatus до вызова этой ветки
  private determineForDeveloperReviewer(context: TaskContext): TaskStatus {
    //повторно проверил и одобрил (after_review + апрув)
    if (context.currentUserApproved() && context.isAfterReview()) {
      return TaskStatus.RE_REVIEWED_AND_APPROVED;
    }

    //апрув после правок
    if (context.currentUserApproved() && context.wasReturnedToDoing()) {
      return TaskStatus.APPROVED_FIXES;
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
  //мердж обрабатывается в determineMergeStatus до вызова этой ветки
  private determineForDeveloperAuthor(context: TaskContext): TaskStatus {
    //принял результат (задача закрыта/смерджена)
    if (context.isIssueClosedWithMerge() || context.isIssueClosed()) {
      return TaskStatus.ACCEPTED_RESULT;
    }

    //переоткрыл задачу
    if (context.currentUserReopenedIssue()) {
      return TaskStatus.REOPENED;
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
}
