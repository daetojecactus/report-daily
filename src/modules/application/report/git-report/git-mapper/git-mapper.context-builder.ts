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
  LabelStatus,
} from 'src/common/enums/label.enum';
import { GitLabAction } from 'src/common/enums/gitlab.enum';
import { TaskRole } from './git-mapper.enums';
import { UserRole } from 'src/modules/application/user/user.enums';

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
        issueCreatedAt: issue.createdAt,
        mergeRequestCreatedAt: mergeRequest?.createdAt ?? null,
        mergeRequestLastCommitAt: mergeRequest?.lastCommitAt ?? null,
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
        issueCreatedAt: null,
        mergeRequestCreatedAt: mergeRequest.createdAt,
        mergeRequestLastCommitAt: mergeRequest.lastCommitAt,
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
    const values = this.extractLabelValues(labels);
    if (values.includes(LabelType.BUG)) return TaskType.BUG;
    if (values.includes(LabelType.FEATURE)) return TaskType.FEATURE;
    if (values.includes(LabelType.MAINTENANCE)) return TaskType.CHORE;
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
