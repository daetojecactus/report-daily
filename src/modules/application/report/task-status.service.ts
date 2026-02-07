import { Injectable } from '@nestjs/common';
import type { TaskActionInfo, TaskInfo } from './report.types';
import type { MRInfo } from '../git/git.types';
import {
  TaskAction,
  TaskStatus,
  TaskType,
} from '../../../common/enums/task.enum';
import { LabelType, LabelStatus } from '../../../common/enums/label.enum';
import { GitLabIssueState } from '../../../common/enums/gitlab.enum';

@Injectable()
export class TaskStatusService {
  resolve(
    actions: TaskActionInfo[],
    taskInfo?: TaskInfo,
    mrInfo?: MRInfo,
  ): TaskStatus {
    const types = new Set(actions.map((action) => action.type));
    const hasMerge = types.has(TaskAction.MERGED);
    const hasOpenedMR = types.has(TaskAction.OPENED_MR);
    const hasCommentMR = types.has(TaskAction.COMMENT_MR);
    const hasCommentIssue = types.has(TaskAction.COMMENT_ISSUE);
    const hasApproval = types.has(TaskAction.APPROVED_MR);
    const hasPush = types.has(TaskAction.PUSH);
    const isClosed = taskInfo?.state === GitLabIssueState.CLOSED;
    const taskType = taskInfo?.taskType || TaskType.UNKNOWN;
    const commentContext = mrInfo?.commentContext;

    const isMyMR = mrInfo
      ? mrInfo.isAuthor || (mrInfo.isAssignedToMe && !mrInfo.isReviewer)
      : false;

    // Мердж
    if (hasMerge) {
      if (mrInfo && !isMyMR) return TaskStatus.MERGED;
      if (!mrInfo && !hasPush && !hasOpenedMR) return TaskStatus.MERGED;
      if (taskType === TaskType.BUG || taskType === TaskType.HOTFIX)
        return TaskStatus.FIXED_BUG;
      if (taskType === TaskType.FEATURE) return TaskStatus.IMPLEMENTED_FEATURE;
      return TaskStatus.COMPLETED;
    }

    if (isClosed && !hasMerge) return TaskStatus.COMPLETED_BY_MERGE;

    // Ревью: только комментарии в MR, MR на ревью, я ревьювер, MR не мой
    if (
      mrInfo &&
      mrInfo.isReviewer &&
      mrInfo.hasReviewLabel &&
      !isMyMR &&
      (hasCommentMR || hasApproval)
    ) {
      if (commentContext?.hadMyCommentsBefore && hasApproval)
        return TaskStatus.APPROVED_AFTER_REVIEW;
      if (commentContext?.hadMyCommentsBefore)
        return TaskStatus.CONTINUED_REVIEW;
      return TaskStatus.REVIEWED;
    }

    // Мой МР на ревью
    if (mrInfo && isMyMR && mrInfo.hasReviewLabel) {
      if (commentContext?.hasOtherComments && commentContext.iReplied)
        return TaskStatus.ANSWERED_REVIEW;
      if (hasPush || hasCommentMR || hasOpenedMR || hasApproval)
        return TaskStatus.SENT_TO_REVIEW;
    }

    // Только комментарий в issue
    if (
      hasCommentIssue &&
      !hasPush &&
      !hasOpenedMR &&
      !hasMerge &&
      !hasCommentMR
    ) {
      if (this.hasLabel(taskInfo?.labels, LabelStatus.NEED_INFORMATION))
        return TaskStatus.NEED_INFORMATION;
      return TaskStatus.COMMENTED;
    }

    // Лейблы передачи
    const labels = taskInfo?.labels || [];
    if (
      this.hasLabel(labels, LabelStatus.FRONTEND) &&
      (hasCommentIssue || hasPush)
    ) {
      return TaskStatus.PASSED_TO_FRONTEND;
    }

    // Doing
    if (this.hasLabel(labels, LabelStatus.DOING)) {
      if (mrInfo?.createdAt && this.isToday(mrInfo.createdAt)) {
        return TaskStatus.STARTED;
      }
      return TaskStatus.CONTINUED;
    }

    if (types.has(TaskAction.OPENED_ISSUE) && types.size === 1) {
      return TaskStatus.CREATED;
    }

    return TaskStatus.CONTINUED;
  }

  determineTaskType(labels: string[]): TaskType {
    if (this.hasLabel(labels, LabelType.BUG)) {
      return TaskType.BUG;
    }
    if (this.hasLabel(labels, LabelType.FEATURE)) {
      return TaskType.FEATURE;
    }
    if (this.hasLabel(labels, LabelType.MAINTENANCE)) {
      return TaskType.CHORE;
    }
    return TaskType.UNKNOWN;
  }

  private hasLabel(labels: string[] | undefined, pattern: string): boolean {
    if (!labels) return false;
    return labels.some((label) => label.toLowerCase().includes(pattern));
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }
}
