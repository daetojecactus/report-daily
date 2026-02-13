import { Injectable } from '@nestjs/common';
import {
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

  //определение статуса задачи
  determineTaskStatus(context: TaskContext): TaskStatus {
    //мр без задачи + приоритет critical/high + тип bug
    if (context.isStandaloneMergeRequest() && context.isUrgentTask()) {
      return TaskStatus.URGENT_HOTFIX;
    }

    //мр без привязанной задачи
    if (context.isStandaloneMergeRequest()) {
      return TaskStatus.HOTFIX;
    }

    // --- задача закрыта + мр смерджена ---

    //на мне + я смерджил + баг → пофиксил баг
    if (
      context.isAssignee() &&
      context.isIssueClosedWithMerge() &&
      context.currentUserMergedMergeRequest() &&
      context.isBug()
    ) {
      return TaskStatus.FIXED_BUG;
    }

    //на мне + я смерджил + фича → реализовал фичу
    if (
      context.isAssignee() &&
      context.isIssueClosedWithMerge() &&
      context.currentUserMergedMergeRequest() &&
      context.isFeature()
    ) {
      return TaskStatus.IMPLEMENTED_FEATURE;
    }

    //на мне + я смерджил → закрыл задачу мержем
    if (
      context.isAssignee() &&
      context.isIssueClosedWithMerge() &&
      context.currentUserMergedMergeRequest()
    ) {
      return TaskStatus.COMPLETED_BY_MERGE;
    }

    //на мне + смерджена но мерджил не я + нет рабочих событий → завершил задачу
    //если есть пуш/открытие мр сегодня — мердж был позже, пропускаем
    if (
      context.isAssignee() &&
      context.isIssueClosedWithMerge() &&
      !context.hasActiveWorkOnMergeRequest()
    ) {
      return TaskStatus.COMPLETED;
    }

    //на мне + задача закрыта без мр
    if (
      context.isAssignee() &&
      context.isIssueClosed() &&
      !context.hasMergeRequest()
    ) {
      return TaskStatus.COMPLETED;
    }

    //ревьюер + разработчик + закрыто + смерджено + апрувнул
    if (
      context.isReviewer() &&
      context.isDeveloper() &&
      context.isIssueClosedWithMerge() &&
      context.currentUserApproved()
    ) {
      return TaskStatus.COMPLETED_CODE_REVIEW;
    }

    //ревьюер + QA + закрыто + смерджено + апрувнул
    if (
      context.isReviewer() &&
      context.isQualityAssurance() &&
      context.isIssueClosedWithMerge() &&
      context.currentUserApproved()
    ) {
      return TaskStatus.COMPLETED_TESTING;
    }

    //ревьюер + закрыто + смерджено + апрувнул
    if (
      context.isReviewer() &&
      context.isIssueClosedWithMerge() &&
      context.currentUserApproved()
    ) {
      return TaskStatus.APPROVED_AND_MERGED;
    }

    //просто смерджил или наблюдатель (нет рабочих событий за день)
    if (
      context.isIssueClosedWithMerge() &&
      !context.hasActiveWorkOnMergeRequest()
    ) {
      return TaskStatus.MERGED;
    }

    // --- задача открыта, мр существует ---

    //ревьюер + разработчик + мр + апрувнул (задача ещё открыта)
    if (
      context.isReviewer() &&
      context.isDeveloper() &&
      context.hasMergeRequest() &&
      context.currentUserApproved()
    ) {
      return TaskStatus.COMPLETED_CODE_REVIEW;
    }

    //ревьюер + QA + мр + апрувнул (задача ещё открыта)
    if (
      context.isReviewer() &&
      context.isQualityAssurance() &&
      context.hasMergeRequest() &&
      context.currentUserApproved()
    ) {
      return TaskStatus.COMPLETED_TESTING;
    }

    //ревьюер + мр + апрувнул (PM/Admin)
    if (
      context.isReviewer() &&
      context.hasMergeRequest() &&
      context.currentUserApproved()
    ) {
      return TaskStatus.APPROVED_AFTER_REVIEW;
    }

    //ревьюер + мр + after_review + оставил комменты
    if (
      context.isReviewer() &&
      context.hasMergeRequest() &&
      context.isAfterReview() &&
      context.currentUserCommentedOnMergeRequest()
    ) {
      return TaskStatus.CONTINUED_REVIEW;
    }

    //ревьюер + мр + диалог в комментах
    if (
      context.isReviewer() &&
      context.hasMergeRequest() &&
      context.hasReviewDialog()
    ) {
      return TaskStatus.CONTINUED_REVIEW;
    }

    //ревьюер + мр + оставил комменты (без ответа автора)
    if (
      context.isReviewer() &&
      context.hasMergeRequest() &&
      context.currentUserCommentedOnMergeRequest()
    ) {
      return TaskStatus.REVIEWED;
    }

    //на мне + мр + другие апрувнули
    if (
      context.isAssignee() &&
      context.hasMergeRequest() &&
      context.isApprovedByOtherUsers()
    ) {
      return TaskStatus.APPROVED;
    }

    //на мне + мр + диалог + задача в фазе ревью
    if (
      context.isAssignee() &&
      context.hasMergeRequest() &&
      context.hasReviewDialog() &&
      context.isInReviewPhase()
    ) {
      return TaskStatus.ANSWERED_REVIEW;
    }

    //на мне + поставил лейбл review
    if (context.isAssignee() && context.currentUserSentToReview()) {
      return TaskStatus.SENT_TO_REVIEW;
    }

    //на мне + поставил лейбл need_information
    if (context.isAssignee() && context.currentUserRequestedInformation()) {
      return TaskStatus.NEED_INFORMATION;
    }

    //на мне + поставил лейбл frontend
    if (context.isAssignee() && context.currentUserPassedToFrontend()) {
      return TaskStatus.PASSED_TO_FRONTEND;
    }

    //на мне + мр создана давно + свежий пуш → вернулся к работе
    if (
      context.isAssignee() &&
      context.hasMergeRequest() &&
      context.isResumedWork() &&
      context.currentUserPushedCode()
    ) {
      return TaskStatus.RESUMED;
    }

    //пушил код в мр
    if (context.hasMergeRequest() && context.currentUserPushedCode()) {
      return TaskStatus.CONTINUED;
    }

    //мр создана сегодня → начал работу
    if (
      context.isAssignee() &&
      context.hasMergeRequest() &&
      context.isMergeRequestCreatedOnReportDate()
    ) {
      return TaskStatus.STARTED;
    }

    //оставил комментарий
    if (context.currentUserCommentedAnywhere()) {
      return TaskStatus.COMMENTED;
    }

    //создал задачу
    if (context.currentUserOpenedIssue()) {
      return TaskStatus.CREATED;
    }

    //создал проект
    if (context.currentUserCreatedProject()) {
      return TaskStatus.CREATED;
    }

    //на мне + лейбл doing
    if (context.isAssignee() && context.isDoing()) {
      return TaskStatus.CONTINUED;
    }

    //на мне + лейбл review
    if (context.isAssignee() && context.isInReview()) {
      return TaskStatus.SENT_TO_REVIEW;
    }

    //на мне + лейбл after_review
    if (context.isAssignee() && context.isAfterReview()) {
      return TaskStatus.ANSWERED_REVIEW;
    }

    //на мне + мр открыта
    if (context.isAssignee() && context.hasMergeRequest()) {
      return TaskStatus.CONTINUED;
    }

    //ревьюер + мр открыта
    if (context.isReviewer() && context.hasMergeRequest()) {
      return TaskStatus.REVIEWED;
    }

    //недостаточно данных
    return TaskStatus.UNKNOWN;
  }

  //построение контекста для задачи
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
        statusLabelsSetByCurrentUser: this.resolveStatusLabelsSetByUser(
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
        statusLabelsSetByCurrentUser: [],
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

  //парсинг сырых данных

  //тип задачи по лейблам
  private resolveTaskType(labels: string[]): TaskType {
    const values = this.extractLabelValues(labels);
    if (values.includes(LabelType.BUG)) return TaskType.BUG;
    if (values.includes(LabelType.FEATURE)) return TaskType.FEATURE;
    if (values.includes(LabelType.MAINTENANCE)) return TaskType.CHORE;
    return TaskType.UNKNOWN;
  }

  //роль пользователя в задаче
  private resolveTaskRole(
    assignee: string | null,
    reviewers: string[],
    username: string,
  ): TaskRole {
    if (assignee === username) return TaskRole.ASSIGNEE;
    if (reviewers.includes(username)) return TaskRole.REVIEWER;
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
