import { Injectable } from '@nestjs/common';
import {
  CleanEvent,
  CleanLabelEvent,
  CleanNote,
  GroupedIssue,
  StandaloneMergeRequest,
  StandalonePush,
} from '../git-group/git-group.interface';
import { TaskContext } from './git-mapper.context';
import { TaskType } from 'src/common/enums/task.enum';
import {
  LabelType,
  LabelPriority,
  LabelQa,
  LabelScope,
  LabelStatus,
  LabelTest,
} from 'src/common/enums/label.enum';
import { GitLabAction } from 'src/common/enums/gitlab.enum';
import { TaskRole } from './git-mapper.enums';
import { UserRole } from 'src/modules/application/user/user.enums';
import {
  collectLabelValues,
  isInScope,
  isNeedsRebaseLabel,
  parseLabel,
  parseLabels,
} from 'src/common/helpers/label.helper';
import type { ParsedLabel } from 'src/common/helpers/label.helper';
import type { TaskLabels } from './git-mapper.interface';

//сборка TaskContext из сырых сгруппированных данных GitLab
@Injectable()
export class GitMapperContextBuilder {
  //построение контекста для задачи (issue)
  buildIssueContext(
    issue: GroupedIssue,
    username: string,
    currentUserGlobalRole: UserRole,
    reportDate: string,
  ): TaskContext {
    const mergeRequest = issue.mergeRequests[0] ?? null;
    const mergeRequestNotes = mergeRequest?.notes ?? [];
    const mergeRequestEvents = mergeRequest?.events ?? [];
    const currentUserApproved = mergeRequestEvents.some(
      (event) => event.actionName === GitLabAction.APPROVED,
    );

    return new TaskContext({
      currentUserGlobalRole,
      userRoleInTask: this.resolveTaskRole(
        issue.assignee,
        mergeRequest?.reviewers ?? [],
        username,
        issue.events,
        currentUserApproved,
      ),
      isMergeRequestAuthor: mergeRequest?.author === username,
      taskType: this.resolveTaskType(issue.labels),
      taskDates: {
        mergeRequestCreatedAt: mergeRequest?.createdAt ?? null,
        mergeRequestLastCommitAt: mergeRequest?.lastCommitAt ?? null,
        reportDate,
      },
      labels: this.buildTaskLabels(issue.labels, issue.labelEvents, username),
      activityStream: {
        issueState: issue.state,
        mergeRequestState: mergeRequest?.state ?? null,
        issueClosedOnReportDate: issue.closedOnReportDate,
        mergeRequestMergedOnReportDate:
          mergeRequest?.mergedOnReportDate ?? false,
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
        commitTitles: this.extractCommitTitles(mergeRequestEvents),
        reviewThreadCount: mergeRequest?.reviewThreads.total ?? 0,
        unresolvedReviewThreadCount:
          mergeRequest?.reviewThreads.unresolved ?? 0,
      },
      approvals: {
        currentUserApproved,
        otherApprovers: this.extractOtherApprovers(mergeRequestNotes, username),
      },
    });
  }

  //построение контекста для standalone мр
  buildStandaloneMergeRequestContext(
    mergeRequest: StandaloneMergeRequest,
    username: string,
    currentUserGlobalRole: UserRole,
    reportDate: string,
  ): TaskContext {
    const currentUserApproved = mergeRequest.events.some(
      (event) => event.actionName === GitLabAction.APPROVED,
    );

    return new TaskContext({
      currentUserGlobalRole,
      userRoleInTask: this.resolveTaskRole(
        mergeRequest.assignee,
        mergeRequest.reviewers,
        username,
        mergeRequest.events,
        currentUserApproved,
      ),
      isMergeRequestAuthor: mergeRequest.author === username,
      taskType: this.resolveTaskType(mergeRequest.labels),
      taskDates: {
        mergeRequestCreatedAt: mergeRequest.createdAt,
        mergeRequestLastCommitAt: mergeRequest.lastCommitAt,
        reportDate,
      },
      labels: this.buildTaskLabels(
        mergeRequest.labels,
        mergeRequest.labelEvents,
        username,
      ),
      activityStream: {
        issueState: null,
        mergeRequestState: mergeRequest.state,
        issueClosedOnReportDate: false,
        mergeRequestMergedOnReportDate: mergeRequest.mergedOnReportDate,
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
        commitTitles: this.extractCommitTitles(mergeRequest.events),
        reviewThreadCount: mergeRequest.reviewThreads.total,
        unresolvedReviewThreadCount: mergeRequest.reviewThreads.unresolved,
      },
      approvals: {
        currentUserApproved,
        otherApprovers: this.extractOtherApprovers(
          mergeRequest.notes,
          username,
        ),
      },
    });
  }

  //проверяет что пуш создал новую ветку
  isNewBranch(push: StandalonePush): boolean {
    return push.events.some(
      (event) =>
        event.pushData?.action === 'created' &&
        event.pushData?.refType === 'branch',
    );
  }

  //тип задачи по лейблам
  private resolveTaskType(labels: string[]): TaskType {
    const types = this.parseLabelTypes(labels);
    if (types.includes(LabelType.HOTFIX)) return TaskType.HOTFIX;
    if (types.includes(LabelType.BUG)) return TaskType.BUG;
    if (types.includes(LabelType.FEATURE)) return TaskType.FEATURE;
    if (types.includes(LabelType.MAINTENANCE)) return TaskType.CHORE;
    if (types.includes(LabelType.EPIC)) return TaskType.EPIC;
    if (types.includes(LabelType.QA)) return TaskType.QA_INTERNAL;
    return TaskType.UNKNOWN;
  }

  //роль пользователя в задаче
  //учитывает: assignee, reviewer (в т.ч. по истории/апруву), а также автор (создатель issue)
  private resolveTaskRole(
    assignee: string | null,
    reviewers: string[],
    username: string,
    events: { actionName: string }[],
    currentUserApproved: boolean,
  ): TaskRole {
    if (assignee === username) return TaskRole.ASSIGNEE;

    //ревьюер: текущий/исторический список ревьюеров либо факт апрува от пользователя.
    //апрув может поставить только назначенный ревьюер, поэтому это надёжный признак,
    //даже если пользователя уже сняли с ревью к моменту формирования отчёта.
    if (reviewers.includes(username) || currentUserApproved) {
      return TaskRole.REVIEWER;
    }

    //если пользователь создал задачу, но не assignee и не reviewer → автор
    const isIssueCreator = events.some(
      (event) =>
        event.actionName === GitLabAction.OPENED ||
        event.actionName === GitLabAction.CREATED,
    );
    if (isIssueCreator) return TaskRole.AUTHOR;

    return TaskRole.OBSERVER;
  }

  //разбор всех лейблов задачи: типы, приоритеты, статусы и точечные qa/test-лейблы
  private buildTaskLabels(
    labels: string[],
    labelEvents: CleanLabelEvent[],
    username: string,
  ): TaskLabels {
    const activeLabels = parseLabels(labels);

    return {
      priorities: this.parseLabelPriorities(labels),
      types: this.parseLabelTypes(labels),
      currentStatus: this.resolveCurrentStatusLabel(labelEvents),
      previousStatus: this.resolvePreviousStatusLabel(labelEvents),
      statusLabelsSetByCurrentUser: this.resolveLabelsSetByUser(
        labelEvents,
        username,
        LabelScope.STATUS,
        Object.values(LabelStatus),
      ),
      priorityChangedByCurrentUser: this.hasPriorityEscalation(
        labelEvents,
        username,
      ),
      activeStatuses: collectLabelValues(
        activeLabels,
        LabelScope.STATUS,
        Object.values(LabelStatus),
      ),
      qaFlags: this.resolveActiveOrAddedLabels(
        activeLabels,
        labelEvents,
        LabelScope.QA,
        Object.values(LabelQa),
      ),
      qaFlagsSetByCurrentUser: this.resolveLabelsSetByUser(
        labelEvents,
        username,
        LabelScope.QA,
        Object.values(LabelQa),
      ),
      testFlags: this.resolveActiveOrAddedLabels(
        activeLabels,
        labelEvents,
        LabelScope.TEST,
        Object.values(LabelTest),
      ),
      needsRebase: activeLabels.some(isNeedsRebaseLabel),
      needsRebaseResolved: labelEvents.some(
        (event) =>
          event.action === 'remove' &&
          isNeedsRebaseLabel(parseLabel(event.labelName)),
      ),
    };
  }

  //лейблы приоритета из сырых лейблов
  private parseLabelPriorities(labels: string[]): LabelPriority[] {
    return collectLabelValues(
      parseLabels(labels),
      LabelScope.PRIORITY,
      Object.values(LabelPriority),
    );
  }

  //лейблы типа из сырых лейблов
  private parseLabelTypes(labels: string[]): LabelType[] {
    return collectLabelValues(
      parseLabels(labels),
      LabelScope.TYPE,
      Object.values(LabelType),
    );
  }

  //последний актуальный статус-лейбл
  private resolveCurrentStatusLabel(
    labelEvents: CleanLabelEvent[],
  ): LabelStatus | null {
    return this.sortStatusAdditions(labelEvents)[0] ?? null;
  }

  //предпоследний статус-лейбл (для определения перехода, например review → doing)
  private resolvePreviousStatusLabel(
    labelEvents: CleanLabelEvent[],
  ): LabelStatus | null {
    return this.sortStatusAdditions(labelEvents)[1] ?? null;
  }

  //статус-лейблы, выставленные за день, от свежих к старым
  private sortStatusAdditions(labelEvents: CleanLabelEvent[]): LabelStatus[] {
    return [...labelEvents]
      .filter(
        (event) =>
          event.action === 'add' &&
          this.matchLabelValue(
            event.labelName,
            LabelScope.STATUS,
            Object.values(LabelStatus),
          ) !== null,
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .map(
        (event) =>
          this.matchLabelValue(
            event.labelName,
            LabelScope.STATUS,
            Object.values(LabelStatus),
          )!,
      );
  }

  //лейблы нужного скоупа, выставленные конкретным пользователем
  private resolveLabelsSetByUser<T extends string>(
    labelEvents: CleanLabelEvent[],
    username: string,
    scope: LabelScope,
    allowedValues: readonly T[],
  ): T[] {
    const values: T[] = [];

    for (const event of labelEvents) {
      if (event.action !== 'add' || event.username !== username) continue;

      const value = this.matchLabelValue(event.labelName, scope, allowedValues);
      if (value) values.push(value);
    }

    return values;
  }

  //лейблы, висящие на задаче сейчас либо навешенные в день отчёта
  //снятый в тот же день лейбл всё равно отражает работу за день, поэтому учитываем оба источника
  private resolveActiveOrAddedLabels<T extends string>(
    activeLabels: ParsedLabel[],
    labelEvents: CleanLabelEvent[],
    scope: LabelScope,
    allowedValues: readonly T[],
  ): T[] {
    const addedToday = labelEvents
      .filter((event) => event.action === 'add')
      .map((event) =>
        this.matchLabelValue(event.labelName, scope, allowedValues),
      )
      .filter((value): value is T => value !== null);

    const active = collectLabelValues(activeLabels, scope, allowedValues);

    return [...new Set([...active, ...addedToday])];
  }

  //значение лейбла, если он принадлежит скоупу и входит в список допустимых
  private matchLabelValue<T extends string>(
    labelName: string,
    scope: LabelScope,
    allowedValues: readonly T[],
  ): T | null {
    const parsed = parseLabel(labelName);
    if (!isInScope(parsed, scope)) return null;

    return allowedValues.find((value) => value === parsed.value) ?? null;
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
        this.matchLabelValue(event.labelName, LabelScope.PRIORITY, [
          LabelPriority.CRITICAL,
        ]) !== null,
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

  //заголовки коммитов из push-событий
  private extractCommitTitles(events: CleanEvent[]): string[] {
    return events
      .map((event) => event.pushData?.commitTitle)
      .filter((title): title is string => Boolean(title));
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
}
