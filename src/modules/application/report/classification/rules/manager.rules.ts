import { Injectable } from '@nestjs/common';
import type { TaskContext } from '../classification.context';
import { ActivityAction } from '../classification.enums';

@Injectable()
export class ManagerRules {
  resolve(context: TaskContext) {
    if (context.isIssueClosedToday()) {
      return context.isFeature()
        ? ActivityAction.REVIEWED_AND_CLOSED
        : ActivityAction.ACCEPTED_WORK;
    }
    if (context.currentUserReopenedIssue()) {
      return ActivityAction.REOPENED;
    }
    if (context.currentUserOpenedIssue()) {
      return this.resolveCreated(context);
    }
    if (context.currentUserEscalatedPriority()) {
      return ActivityAction.ESCALATED_PRIORITY;
    }
    if (context.currentUserMarkedReadyForQa()) {
      return ActivityAction.TASK_SENT_TO_QA;
    }
    if (context.currentUserReturnedTaskToDevelopment()) {
      return ActivityAction.TASK_RETURNED_FROM_QA;
    }
    if (context.currentUserPlannedTask()) {
      return ActivityAction.PLANNED_FOR_SPRINT;
    }
    if (
      (context.currentUserReturnedToDoing() || context.isDoing()) &&
      context.currentUserCommentedAnywhere()
    ) {
      return ActivityAction.DELEGATED_TASK;
    }
    if (context.currentUserCommentedAnywhere() && context.isNeedInformation()) {
      return ActivityAction.PROVIDED_REQUIREMENTS;
    }
    if (context.isReturnedFromQa()) {
      return ActivityAction.TASK_RETURNED_FROM_QA;
    }
    if (context.isInQaFlow()) {
      return ActivityAction.TASK_IN_QA_TESTING;
    }
    if (context.currentUserCommentedAnywhere()) {
      return ActivityAction.COMMENTED;
    }
    return ActivityAction.UNKNOWN;
  }

  private resolveCreated(context: TaskContext) {
    if (context.isFeature()) {
      return ActivityAction.PLANNED_FEATURE;
    }
    return context.isBug() ? ActivityAction.REPORTED_BUG : ActivityAction.CREATED;
  }
}
