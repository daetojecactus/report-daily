import { Injectable } from '@nestjs/common';
import type { TaskContext } from '../classification.context';
import { ActivityAction } from '../classification.enums';
import { DeveloperRules } from './developer.rules';
import { QaInternalRules } from './qa-internal.rules';

@Injectable()
export class QaRules {
  constructor(
    private readonly qaInternalRules: QaInternalRules,
    private readonly developerRules: DeveloperRules,
  ) {}

  resolve(context: TaskContext) {
    if (context.isQaInternalTask()) {
      return this.qaInternalRules.resolve(context);
    }
    if (context.isE2ECoverageWork()) {
      return ActivityAction.QA_E2E_COVERAGE_ADDED;
    }
    if (context.currentUserReturnedTaskToDevelopment()) {
      return ActivityAction.QA_RETURNED_TO_DEV;
    }
    if (context.currentUserMarkedQaPassed()) {
      return ActivityAction.TESTED_AND_APPROVED;
    }
    return context.isReviewer() ? this.resolveReviewer(context) : this.resolveWorker(context);
  }

  private resolveReviewer(context: TaskContext) {
    const lifecycle = this.resolveLifecycle(context);
    if (lifecycle) {
      return lifecycle;
    }
    if (context.currentUserEscalatedPriority() && context.isBug() && context.isTesting()) {
      return ActivityAction.BLOCKED_RELEASE;
    }
    if (context.currentUserApproved()) {
      return context.isAfterReview()
        ? ActivityAction.APPROVED_AFTER_REWORK
        : ActivityAction.TESTED_AND_APPROVED;
    }
    if (context.currentUserReturnedToDoing() && context.wasReturnedToDoing()) {
      return ActivityAction.RETURNED_FOR_REVISION;
    }
    if (context.currentUserStartedTesting()) {
      return ActivityAction.QA_IN_PROGRESS;
    }
    if (context.currentUserCommentedOnMergeRequest()) {
      return context.hasManyMergeRequestComments()
        ? ActivityAction.TESTED_WITH_COMMENTS
        : ActivityAction.REVIEW_COMMENT;
    }
    const fallback = this.resolveFallback(context);
    if (fallback) {
      return fallback;
    }
    return context.isInReviewPhase() ? ActivityAction.QA_IN_PROGRESS : ActivityAction.UNKNOWN;
  }

  private resolveWorker(context: TaskContext) {
    const lifecycle = this.resolveLifecycle(context);
    if (lifecycle) {
      return lifecycle;
    }
    if (context.currentUserOpenedIssue() && context.isBug()) {
      return context.isTesting() ? ActivityAction.REGRESSION_FOUND : ActivityAction.FOUND_BUG;
    }
    if (context.currentUserOpenedIssue()) {
      return ActivityAction.CREATED;
    }
    if (context.currentUserEscalatedPriority() && context.isBug() && context.isTesting()) {
      return ActivityAction.BLOCKED_RELEASE;
    }
    if (context.currentUserPushedCode() && context.isE2E()) {
      return ActivityAction.WROTE_TESTS;
    }
    if (context.currentUserSentToReview()) {
      return ActivityAction.SENT_TO_REVIEW;
    }
    if (context.currentUserPushedCode() && context.isAfterReview()) {
      return ActivityAction.CORRECTED_AFTER_REVIEW;
    }
    if (context.currentUserPushedCode() && context.isMergeRequestCreatedOnReportDate()) {
      return ActivityAction.STARTED_IMPLEMENTATION;
    }
    if (context.currentUserPushedCode() && context.hasMergeRequest()) {
      return ActivityAction.WROTE_CODE;
    }
    if (context.currentUserStartedTesting()) {
      return ActivityAction.QA_IN_PROGRESS;
    }
    return this.resolveFallback(context) ?? this.developerRules.resolveAssignee(context);
  }

  private resolveLifecycle(context: TaskContext) {
    if (context.isIssueClosedToday()) {
      return ActivityAction.VERIFIED_FIX;
    }
    if (context.currentUserReopenedIssue()) {
      return context.isBug() ? ActivityAction.REOPENED_BUG : ActivityAction.REOPENED;
    }
    return null;
  }

  private resolveFallback(context: TaskContext) {
    if (
      context.currentUserCommentedOnIssue() &&
      (context.isDoing() || context.isNeedInformation()) &&
      context.isBug()
    ) {
      return ActivityAction.CLARIFIED_BUG;
    }
    if (context.currentUserCommentedAnywhere()) {
      return ActivityAction.COMMENTED;
    }
    if (context.isReadyForQa()) {
      return ActivityAction.QA_AWAITING_TESTING;
    }
    return null;
  }
}
