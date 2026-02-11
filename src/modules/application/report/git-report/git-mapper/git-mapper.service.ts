import { Injectable } from '@nestjs/common';
import {
  GroupedDailyData,
  GroupedIssue,
  StandaloneMergeRequest,
  StandalonePush,
} from '../git-group/git-group.interface';
import {
  MappedDailyData,
  MappedIssue,
  MappedMergeRequest,
  MappedPush,
  StatusContext,
  WorkResult,
} from './git-mapper.interface';
import { TaskStatus, TaskType } from 'src/common/enums/task.enum';
import { LabelStatus, LabelType } from 'src/common/enums/label.enum';
import { GitLabAction } from 'src/common/enums/gitlab.enum';
import { GitLabEvent } from 'src/modules/vendors/gitlab/gitlab.types';

@Injectable()
export class GitMapperService {
  //преобразует сгруппированные данные в данные с определенными статусами
  mapGroupedData(data: GroupedDailyData): MappedDailyData {
    return {
      issues: data.issues.map((issue) => this.mapIssue(issue)),
      standaloneMergeRequests: data.standaloneMergeRequests.map((mr) =>
        this.mapStandaloneMr(mr),
      ),
      standalonePushes: data.standalonePushes.map((push) => this.mapPush(push)),
    };
  }

  //маппит задачу с вложенными мр
  private mapIssue(issue: GroupedIssue): MappedIssue {
    const allEvents = [
      ...issue.events,
      ...issue.mergeRequests.flatMap((mr) => mr.events),
    ];

    const context = this.buildContext(allEvents, issue.labels, {
      issueState: issue.state,
      mrState: issue.mergeRequests[0]?.state,
    });

    return {
      ...issue,
      workResult: this.determineWorkResult(context, issue.labels),
    };
  }

  //маппит standalone мр
  private mapStandaloneMr(mr: StandaloneMergeRequest): MappedMergeRequest {
    const context = this.buildContext(mr.events, mr.labels, {
      mrState: mr.state,
    });

    return {
      ...mr,
      workResult: this.determineWorkResult(context, mr.labels),
    };
  }

  //маппит standalone пуш
  private mapPush(push: StandalonePush): MappedPush {
    const context = this.buildContext(push.events, [], {});

    return {
      ...push,
      workResult: {
        status: TaskStatus.CONTINUED,
        taskType: TaskType.UNKNOWN,
      },
    };
  }

  //собирает контекст из событий для определения статуса
  private buildContext(
    events: GitLabEvent[],
    labels: string[],
    states: { issueState?: string; mrState?: string },
  ): StatusContext {
    return {
      hasCreatedToday: events.some(
        (e) => e.action_name === GitLabAction.CREATED,
      ),
      hasClosedToday: events.some((e) => e.action_name === GitLabAction.CLOSED),
      hasPushToday: events.some((e) => e.push_data !== undefined),
      hasCommentToday: events.some(
        (e) => e.action_name === GitLabAction.COMMENTED_ON,
      ),
      hasMergedToday: events.some((e) => e.action_name === GitLabAction.MERGED),
      hasOpenedMrToday: events.some(
        (e) => e.action_name === GitLabAction.CREATED,
      ),
      labels,
      ...states,
    };
  }

  //определяет тип задачи по лейблам
  private determineTaskType(labels: string[]): TaskType {
    const lowercaseLabels = labels.map((l) => l.toLowerCase());

    if (lowercaseLabels.includes(LabelType.BUG)) return TaskType.BUG;
    if (lowercaseLabels.includes(LabelType.FEATURE)) return TaskType.FEATURE;
    if (lowercaseLabels.includes(LabelType.MAINTENANCE)) return TaskType.CHORE;

    return TaskType.UNKNOWN;
  }

  //главная функция определения статуса — тут все условия
  private determineWorkResult(
    context: StatusContext,
    labels: string[],
  ): WorkResult {
    const taskType = this.determineTaskType(labels);
    const status = this.determineStatus(context);

    return { status, taskType };
  }

  //определяет статус работы по контексту — ДОБАВЛЯЙ СВОИ КЕЙСЫ СЮДА
  private determineStatus(ctx: StatusContext): TaskStatus {
    const hasLabel = (label: string) =>
      ctx.labels.some((l) => l.toLowerCase() === label.toLowerCase());

    //мр замержен сегодня
    if (ctx.hasMergedToday) {
      return TaskStatus.MERGED;
    }

    //задача закрыта сегодня
    if (ctx.hasClosedToday) {
      return TaskStatus.COMPLETED;
    }

    //мр открыт сегодня + лейбл review
    if (ctx.hasOpenedMrToday && hasLabel(LabelStatus.REVIEW)) {
      return TaskStatus.SENT_TO_REVIEW;
    }

    //есть комменты + мр в review
    if (ctx.hasCommentToday && hasLabel(LabelStatus.REVIEW)) {
      return TaskStatus.ANSWERED_REVIEW;
    }

    //есть пуши + лейбл doing
    if (ctx.hasPushToday && hasLabel(LabelStatus.DOING)) {
      return TaskStatus.CONTINUED;
    }

    //задача создана сегодня
    if (ctx.hasCreatedToday) {
      return TaskStatus.STARTED;
    }

    //есть пуши
    if (ctx.hasPushToday) {
      return TaskStatus.CONTINUED;
    }

    //есть комменты
    if (ctx.hasCommentToday) {
      return TaskStatus.COMMENTED;
    }

    //лейбл need information
    if (hasLabel(LabelStatus.NEED_INFORMATION)) {
      return TaskStatus.NEED_INFORMATION;
    }

    //лейбл frontend
    if (hasLabel(LabelStatus.FRONTEND)) {
      return TaskStatus.PASSED_TO_FRONTEND;
    }

    return TaskStatus.UNKNOWN;
  }
}
