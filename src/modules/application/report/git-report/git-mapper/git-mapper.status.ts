import { Injectable } from '@nestjs/common';
import { TaskContext } from './git-mapper.context';
import { TaskStatus } from 'src/common/enums/task.enum';

//rule engine: определяет статус задачи по контексту и роли пользователя
@Injectable()
export class GitMapperStatusResolver {
  //определение статуса по роли
  resolve(context: TaskContext): TaskStatus {
    //задача отложена — итог дня по ней для любой роли,
    //кроме случаев когда её всё же довели до закрытия или мерджа
    if (
      context.currentUserPutOnHold() &&
      !context.currentUserClosedIssue() &&
      !context.currentUserMergedMergeRequest()
    ) {
      return TaskStatus.PUT_ON_HOLD;
    }

    //стезя pm и системного аналитика — процесс (планирование/приёмка), мердж кода нетипичен
    if (context.isNonEngineeringRole()) {
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

    //мердж тестового кода: e2e-покрытие и внутренние qa-задачи важнее типа задачи.
    //пуш мог быть раньше дня мерджа, поэтому здесь он не обязателен
    if (
      context.needsE2ECoverage() &&
      (context.isQualityAssurance() || context.hasTestRelatedCommits())
    ) {
      return TaskStatus.QA_E2E_COVERAGE_ADDED;
    }
    if (context.isQaInternalTask()) {
      return this.determineQaInternalWork(context, true);
    }

    //хотфикс: явный лейбл type::hotfix либо срочный мердж отдельного мр без задачи.
    //факт деплоя из gitlab не виден — мы знаем только про мердж, поэтому про прод не заявляем
    if (
      context.isHotfix() ||
      (context.isStandaloneMergeRequest() &&
        (context.isCriticalPriority() || context.isUrgentTask()))
    ) {
      return TaskStatus.HOTFIX_DEPLOYED;
    }

    //свой мердж по типу задачи
    if (context.isBug()) return TaskStatus.FIXED_BUG;
    if (context.isFeature()) return TaskStatus.IMPLEMENTED_FEATURE;
    return TaskStatus.COMPLETED_BY_MERGE;
  }

  //определяем для qa
  private determineForQA(context: TaskContext): TaskStatus {
    //внутренняя задача qa (type::qa) — автоматизация и инфраструктура, а не мануальный тест
    if (context.isQaInternalTask()) {
      return this.determineQaInternalWork(context);
    }

    //разработка e2e-покрытия (test::e2e required / type::e2e)
    if (context.isE2ECoverageWork()) {
      return TaskStatus.QA_E2E_COVERAGE_ADDED;
    }

    //забраковал и вернул в разработку — терминальный итог дня по задаче
    if (context.currentUserReturnedTaskToDevelopment()) {
      return TaskStatus.QA_RETURNED_TO_DEV;
    }

    //подтвердил успешное прохождение тестирования (status::QA passed)
    if (context.currentUserMarkedQaPassed()) {
      return TaskStatus.TESTED_AND_APPROVED;
    }

    //qa как ревьюер
    if (context.isReviewer()) {
      return this.determineForQAReviewer(context);
    }

    //qa не ревьюер
    return this.determineForQAWorker(context);
  }

  //внутренняя работа qa: автотесты, поддержка покрытия, тестовое окружение
  //hasCodeWork передаётся отдельно: при мердже своего мр код написан, даже если пуш был раньше
  private determineQaInternalWork(
    context: TaskContext,
    hasCodeWork: boolean = context.currentUserPushedCode(),
  ): TaskStatus {
    //e2e-покрытие для задачи
    if (context.needsE2ECoverage() && hasCodeWork) {
      return TaskStatus.QA_E2E_COVERAGE_ADDED;
    }

    //починка и актуализация существующих тестов (упавшие тесты, рефакторинг на POM)
    if (hasCodeWork && (context.isMaintenance() || context.isBug())) {
      return TaskStatus.QA_AUTOMATION_MAINTAINED;
    }

    //разработка новых автотестов
    if (hasCodeWork) {
      return TaskStatus.QA_AUTOMATION_DEVELOPED;
    }

    //отдал автотесты на ревью
    if (context.currentUserSentToReview()) {
      return TaskStatus.SENT_TO_REVIEW;
    }

    //работа без кода над окружением/инструментарием
    if (context.isMaintenance()) {
      return TaskStatus.QA_TEST_ENVIRONMENT_SETUP;
    }

    return TaskStatus.QA_INTERNAL_TASK;
  }

  //общее начало обеих qa-веток: жизненный цикл самой задачи
  private resolveQaIssueLifecycle(context: TaskContext): TaskStatus | null {
    //закрыл задачу и принял исправление
    if (context.isIssueClosedToday()) {
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

    return null;
  }

  //общий хвост обеих qa-веток: слабые сигналы, когда явных действий не нашлось
  private resolveQaFallback(context: TaskContext): TaskStatus | null {
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

    //задача передана на тестирование, но работа по ней ещё не началась
    if (context.isReadyForQa()) {
      return TaskStatus.QA_AWAITING_TESTING;
    }

    return null;
  }

  //qa как ревьюер
  private determineForQAReviewer(context: TaskContext): TaskStatus {
    const lifecycle = this.resolveQaIssueLifecycle(context);
    if (lifecycle) return lifecycle;

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

    //взял задачу на тестирование (status::QA in progress)
    if (context.currentUserStartedQaTesting()) {
      return TaskStatus.QA_IN_PROGRESS;
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

    //оставил комментарий к мр
    if (context.currentUserCommentedOnMergeRequest()) {
      return TaskStatus.REVIEW_COMMENT;
    }

    const fallback = this.resolveQaFallback(context);
    if (fallback) return fallback;

    //статус review у команды означает «ожидает проверки либо тестирования»:
    //для тестировщика, назначенного проверяющим, это его проверка, а не код-ревью
    if (context.isInReviewPhase()) {
      return TaskStatus.QA_IN_PROGRESS;
    }

    return TaskStatus.UNKNOWN;
  }

  //qa не ревьюер
  private determineForQAWorker(context: TaskContext): TaskStatus {
    const lifecycle = this.resolveQaIssueLifecycle(context);
    if (lifecycle) return lifecycle;

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
      return TaskStatus.CREATED;
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

    //взял задачу на тестирование (status::QA in progress)
    if (context.currentUserStartedQaTesting()) {
      return TaskStatus.QA_IN_PROGRESS;
    }

    return (
      this.resolveQaFallback(context) ??
      //дальше как разработчик (мр, статусы, fallback)
      this.determineForDeveloperAssignee(context)
    );
  }

  //pm
  private determineForPM(context: TaskContext): TaskStatus {
    //проверил и закрыл фичу
    if (context.isIssueClosedToday() && context.isFeature()) {
      return TaskStatus.REVIEWED_AND_CLOSED;
    }

    //закрыл задачу
    if (context.isIssueClosedToday()) {
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

    //сам передал задачу на тестирование
    if (context.currentUserMarkedReadyForQa()) {
      return TaskStatus.TASK_SENT_TO_QA;
    }

    //сам вернул задачу в разработку по итогам тестирования
    if (context.currentUserReturnedTaskToDevelopment()) {
      return TaskStatus.TASK_RETURNED_FROM_QA;
    }

    //взял задачу в план спринта
    if (context.currentUserPlannedTask()) {
      return TaskStatus.PLANNED_FOR_SPRINT;
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

    //дальше — контекст задачи, а не действие самого pm:
    //эти статусы отражают, на каком этапе задача, если своих действий по ней не было

    //задача вернулась с тестирования в разработку
    if (context.isReturnedFromQa()) {
      return TaskStatus.TASK_RETURNED_FROM_QA;
    }

    //задача в контуре тестирования: ждёт, проверяется или уже проверена
    if (context.isInQaFlow()) {
      return TaskStatus.TASK_IN_QA_TESTING;
    }

    //прокомментировал задачу
    if (context.currentUserCommentedAnywhere()) {
      return TaskStatus.COMMENTED;
    }

    return TaskStatus.UNKNOWN;
  }

  //developer/admin
  private determineForDeveloper(context: TaskContext): TaskStatus {
    //внутренняя qa-задача (type::qa): пишет автотесты, а не продуктовый код
    if (context.isQaInternalTask() && context.currentUserPushedCode()) {
      return this.determineQaInternalWork(context);
    }

    //разработка e2e-покрытия по задаче с test::e2e required
    if (context.isE2ECoverageWork()) {
      return TaskStatus.QA_E2E_COVERAGE_ADDED;
    }

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

    //тестирование пройдено успешно именно сегодня — заметный итог дня
    if (context.isQaPassedToday()) {
      return TaskStatus.DEV_PASSED_QA;
    }

    //исправил замечания qa и вернул задачу на тестирование
    if (context.isReturnedFromQa() && context.currentUserMarkedReadyForQa()) {
      return TaskStatus.DEV_RESUBMITTED_TO_QA;
    }

    //передал задачу на тестирование
    if (context.currentUserMarkedReadyForQa()) {
      return TaskStatus.TASK_SENT_TO_QA;
    }

    //правит замечания после возврата с тестирования
    if (context.isReturnedFromQa() && context.currentUserPushedCode()) {
      return TaskStatus.DEV_FIXING_AFTER_QA;
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

    //работа по замечаниям ревью.
    //треды в мр — это именно замечания: обычный комментарий в gitlab не резолвится
    if (context.currentUserPushedCode() && context.isAssignee()) {
      if (context.hasReviewThreads()) {
        return context.hasUnresolvedReviewThreads()
          ? TaskStatus.RESOLVING_REVIEW_COMMENTS
          : TaskStatus.RESOLVED_REVIEW_COMMENTS;
      }

      //тредов нет: переписка считается работой по ревью, только если задача на ревью,
      //иначе это просто обсуждение и оно разбирается ниже
      if (context.hasReviewDialog() && context.isInReviewPhase()) {
        return TaskStatus.RESOLVING_REVIEW_COMMENTS;
      }
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

    //обновил ветку после конфликтов (лейбл needs-rebase сняли, а код запушен)
    if (context.currentUserResolvedRebase()) {
      return TaskStatus.RESOLVED_MERGE_CONFLICTS;
    }

    //покрыл задачу юнит-тестами (test::unit + коммиты с тестами)
    if (
      context.currentUserPushedCode() &&
      context.isUnitTestRequired() &&
      context.hasTestRelatedCommits()
    ) {
      return TaskStatus.WROTE_TESTS;
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

    //комментировал, но нет активной работы с кодом
    if (
      context.isAssignee() &&
      context.currentUserCommentedAnywhere() &&
      !context.hasActiveWorkOnMergeRequest()
    ) {
      return TaskStatus.COMMENTED;
    }

    //задача вернулась с тестирования и остаётся на исполнителе
    if (context.isAssignee() && context.isReturnedFromQa()) {
      return TaskStatus.DEV_FIXING_AFTER_QA;
    }

    //тестирование по задаче уже пройдено, активной работы за день не было
    if (context.isAssignee() && context.isQaPassed()) {
      return TaskStatus.DEV_PASSED_QA;
    }

    //задача ждёт тестирования: лейбл мог выставить не сам исполнитель
    if (context.isAssignee() && context.isReadyForQa()) {
      return TaskStatus.TASK_SENT_TO_QA;
    }

    //задача на тестировании у qa
    if (context.isAssignee() && context.isQaInProgress()) {
      return TaskStatus.TASK_IN_QA_TESTING;
    }

    //задача отложена (лейбл выставил не сам исполнитель)
    if (context.isAssignee() && context.isOnHold()) {
      return TaskStatus.PUT_ON_HOLD;
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
      (context.isIssueClosedToday() || context.isMergeRequestMergedToday())
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
    if (context.isIssueClosedToday()) {
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
