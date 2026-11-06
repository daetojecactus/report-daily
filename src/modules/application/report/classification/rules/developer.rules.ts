import { Injectable } from '@nestjs/common';
import type { TaskContext } from '../classification.context';
import { ActivityAction } from '../classification.enums';
import { QaInternalRules } from './qa-internal.rules';

@Injectable()
export class DeveloperRules {
  constructor(private readonly qaInternalRules: QaInternalRules) {}

  resolve(context: TaskContext) {
    if (context.isQaInternalTask() && context.currentUserPushedCode()) {
      return this.qaInternalRules.resolve(context);
    }
    if (context.isE2ECoverageWork()) {
      return ActivityAction.QA_E2E_COVERAGE_ADDED;
    }
    if (context.isReviewer()) {
      return this.resolveReviewer(context);
    }
    if (context.isAuthor()) {
      return this.resolveAuthor(context);
    }
    return this.resolveAssignee(context);
  }

  resolveAssignee(context: TaskContext) {
    return (
      this.resolveOutcome(context) ??
      this.resolveCodeWork(context) ??
      this.resolveDiscussion(context) ??
      this.resolveTaskState(context) ??
      this.resolveParticipation(context)
    );
  }

  private resolveOutcome(context: TaskContext) {
    if (context.isIssueClosedWithMerge() && context.isAssignee()) {
      return ActivityAction.COMPLETED_BY_MERGE;
    }
    if (context.isClosedWithoutMerge() && context.isAssignee()) {
      return ActivityAction.CLOSED_WITHOUT_MERGE;
    }
    if (context.currentUserReopenedIssue()) {
      return ActivityAction.REOPENED;
    }
    if (context.isQaPassedToday()) {
      return ActivityAction.DEV_PASSED_QA;
    }
    if (context.currentUserMarkedReadyForQa()) {
      return context.isReturnedFromQa()
        ? ActivityAction.DEV_RESUBMITTED_TO_QA
        : ActivityAction.TASK_SENT_TO_QA;
    }
    if (context.isReturnedFromQa() && context.currentUserPushedCode()) {
      return ActivityAction.DEV_FIXING_AFTER_QA;
    }
    if (context.currentUserSentToReview()) {
      return ActivityAction.SENT_TO_REVIEW;
    }
    if (context.isApprovedByOtherUsers() && context.isAssignee()) {
      return ActivityAction.PASSED_REVIEW;
    }
    if (context.currentUserRequestedInformation()) {
      return ActivityAction.NEED_INFORMATION;
    }
    if (context.currentUserHandedOff()) {
      return ActivityAction.HANDED_OFF;
    }
    return null;
  }

  private resolveCodeWork(context: TaskContext) {
    if (!context.currentUserPushedCode()) {
      return null;
    }
    if (context.isAssignee() && context.hasReviewThreads()) {
      return context.hasUnresolvedReviewThreads()
        ? ActivityAction.RESOLVING_REVIEW_COMMENTS
        : ActivityAction.RESOLVED_REVIEW_COMMENTS;
    }
    if (context.isAssignee() && context.hasReviewDialog() && context.isInReviewPhase()) {
      return ActivityAction.RESOLVING_REVIEW_COMMENTS;
    }
    if (context.isSupportingContributor()) {
      return this.resolveContribution(context);
    }
    if (context.isAfterReview()) {
      return ActivityAction.CORRECTED_AFTER_REVIEW;
    }
    if (context.currentUserResolvedRebase()) {
      return ActivityAction.RESOLVED_MERGE_CONFLICTS;
    }
    if (context.isUnitTestRequired() && context.hasTestRelatedCommits()) {
      return ActivityAction.WROTE_TESTS;
    }
    if (context.isMaintenance()) {
      return ActivityAction.REFACTORED_CODE;
    }
    if (context.isResumedWork()) {
      return ActivityAction.RESUMED_WORK;
    }
    if (context.isMergeRequestCreatedOnReportDate()) {
      return ActivityAction.STARTED_IMPLEMENTATION;
    }
    return context.hasMergeRequest() ? ActivityAction.WROTE_CODE : null;
  }

  private resolveContribution(context: TaskContext) {
    if (context.hasReviewDialog()) {
      return ActivityAction.PAIRED_ON_TASK;
    }
    if (context.isBug()) {
      return ActivityAction.HELPED_RESOLVE_BUG;
    }
    return context.isSecondaryContributor()
      ? ActivityAction.CONTRIBUTED_CODE
      : ActivityAction.HELPED_WITH_TASK;
  }

  private resolveDiscussion(context: TaskContext) {
    if (
      context.isAssignee() &&
      context.hasMergeRequest() &&
      context.isMergeRequestCreatedOnReportDate()
    ) {
      return ActivityAction.STARTED_IMPLEMENTATION;
    }
    if (context.hasReviewDialog() && context.isAssignee()) {
      return ActivityAction.DISCUSSED_CODE;
    }
    if (context.currentUserOpenedIssue()) {
      return ActivityAction.CREATED;
    }
    if (
      context.isAssignee() &&
      context.currentUserCommentedAnywhere() &&
      !context.hasActiveWorkOnMergeRequest()
    ) {
      return ActivityAction.COMMENTED;
    }
    return null;
  }

  private resolveTaskState(context: TaskContext) {
    if (!context.isAssignee()) {
      return null;
    }
    if (context.isReturnedFromQa()) {
      return ActivityAction.DEV_FIXING_AFTER_QA;
    }
    if (context.isQaPassed()) {
      return ActivityAction.DEV_PASSED_QA;
    }
    if (context.isReadyForQa()) {
      return ActivityAction.TASK_SENT_TO_QA;
    }
    if (context.isTesting()) {
      return ActivityAction.TASK_IN_QA_TESTING;
    }
    if (context.isOnHold()) {
      return ActivityAction.PUT_ON_HOLD;
    }
    if (context.isDoing()) {
      return ActivityAction.CONTINUED;
    }
    if (context.isInReview()) {
      return ActivityAction.SENT_TO_REVIEW;
    }
    if (context.isAfterReview()) {
      return ActivityAction.CORRECTED_AFTER_REVIEW;
    }
    return context.hasMergeRequest() ? ActivityAction.CONTINUED : null;
  }

  private resolveParticipation(context: TaskContext) {
    if (context.isStandaloneMergeRequest()) {
      return context.currentUserPushedCode() ? ActivityAction.WROTE_CODE : ActivityAction.CONTINUED;
    }
    if (
      context.isObserver() &&
      context.currentUserCommentedAnywhere() &&
      (context.isIssueClosedToday() || context.isMergeRequestMergedToday())
    ) {
      return ActivityAction.PARTICIPATED_IN_CLOSURE;
    }
    if (
      !context.isAssignee() &&
      context.currentUserCommentedOnMergeRequest() &&
      !context.hasActiveWorkOnMergeRequest()
    ) {
      return context.isSecondaryContributor()
        ? ActivityAction.ASSISTED_REVIEW
        : ActivityAction.LEFT_SUGGESTION;
    }
    return context.currentUserCommentedAnywhere()
      ? ActivityAction.COMMENTED
      : ActivityAction.UNKNOWN;
  }

  private resolveReviewer(context: TaskContext) {
    if (context.currentUserApproved()) {
      if (context.isAfterReview()) {
        return ActivityAction.RE_REVIEWED_AND_APPROVED;
      }
      return context.wasReturnedToDoing()
        ? ActivityAction.APPROVED_FIXES
        : ActivityAction.APPROVED_MR;
    }
    if (context.currentUserCommentedOnMergeRequest()) {
      return context.hasManyMergeRequestComments()
        ? ActivityAction.REQUESTED_CHANGES
        : ActivityAction.REVIEW_COMMENT;
    }
    if (context.currentUserReturnedToDoing() && context.wasReturnedToDoing()) {
      return ActivityAction.RETURNED_FOR_REVISION;
    }
    if (context.currentUserCommentedOnIssue()) {
      return ActivityAction.COMMENTED;
    }
    return context.hasMergeRequest() ? ActivityAction.STARTED_REVIEW : ActivityAction.UNKNOWN;
  }

  private resolveAuthor(context: TaskContext) {
    if (context.isIssueClosedToday()) {
      return ActivityAction.ACCEPTED_RESULT;
    }
    if (context.currentUserReopenedIssue()) {
      return ActivityAction.REOPENED;
    }
    if (context.currentUserOpenedIssue()) {
      if (context.isMaintenance()) {
        return ActivityAction.CREATED_TECH_DEBT;
      }
      return context.isBug() ? ActivityAction.FOUND_BUG_DURING_WORK : ActivityAction.CREATED;
    }
    return context.currentUserCommentedAnywhere()
      ? ActivityAction.COMMENTED
      : ActivityAction.UNKNOWN;
  }
}
