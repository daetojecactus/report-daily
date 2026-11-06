import { ItemState, SourceEventAction } from 'src/modules/application/source/source.enums';
import {
  Priority,
  TaskFlag,
  TaskKind,
  WorkflowState,
} from 'src/modules/application/trait/trait.enums';
import { JobRole } from 'src/modules/application/user/user.enums';
import {
  CLASSIFICATION_DATE_LENGTH,
  CLASSIFICATION_DAY_MS,
  CLASSIFICATION_MANY_COMMENTS,
  CLASSIFICATION_OPEN_ACTIONS,
  CLASSIFICATION_PUSH_ACTIONS,
  CLASSIFICATION_RESUMED_WORK_DAYS,
  CLASSIFICATION_RETURNED_FROM_STATES,
  CLASSIFICATION_TEST_COMMIT_PATTERN,
  ENGAGEMENT_COMMENT_CAP,
  ENGAGEMENT_COMMIT_CAP,
  ENGAGEMENT_STATE_CHANGE_CAP,
  ENGAGEMENT_THRESHOLDS,
  ENGAGEMENT_WEIGHTS,
} from './constants/classification.constants';
import { EngagementLevel, TaskRole } from './classification.enums';
import type { EngagementResult, TaskContextData } from './classification.interface';

export class TaskContext {
  readonly kind: TaskKind | null;

  private engagement: EngagementResult | null = null;

  constructor(private readonly data: TaskContextData) {
    this.kind = data.kind;
  }

  isAssignee() {
    return this.data.taskRole === TaskRole.ASSIGNEE;
  }

  isReviewer() {
    return this.data.taskRole === TaskRole.REVIEWER;
  }

  isAuthor() {
    return this.data.taskRole === TaskRole.AUTHOR;
  }

  isObserver() {
    return this.data.taskRole === TaskRole.OBSERVER;
  }

  isQualityAssurance() {
    return this.data.role === JobRole.QA;
  }

  isProjectManager() {
    return this.data.role === JobRole.PROJECT_MANAGER;
  }

  isSystemAnalyst() {
    return this.data.role === JobRole.SYSTEM_ANALYST;
  }

  isNonEngineeringRole() {
    return this.isProjectManager() || this.isSystemAnalyst();
  }

  isStandaloneMergeRequest() {
    return this.data.activity.issueState === null && this.data.activity.mergeRequestState !== null;
  }

  isIssueClosedToday() {
    return this.currentUserClosedIssue() || this.data.activity.issueClosedOnReportDate;
  }

  isMergeRequestMergedToday() {
    return (
      this.currentUserMergedMergeRequest() || this.data.activity.mergeRequestMergedOnReportDate
    );
  }

  hasMergeRequest() {
    return this.data.activity.mergeRequestState !== null;
  }

  isMergeRequestMerged() {
    return this.data.activity.mergeRequestState === ItemState.MERGED;
  }

  isIssueClosedWithMerge() {
    return this.isIssueClosedToday() && this.isMergeRequestMerged();
  }

  isBug() {
    return this.kind === TaskKind.BUG;
  }

  isFeature() {
    return this.kind === TaskKind.FEATURE;
  }

  isHotfix() {
    return this.data.traits.kinds.includes(TaskKind.HOTFIX);
  }

  isMaintenance() {
    return this.kind === TaskKind.MAINTENANCE;
  }

  isE2E() {
    return this.data.traits.kinds.includes(TaskKind.TEST_AUTOMATION);
  }

  isQaInternalTask() {
    return this.data.traits.kinds.includes(TaskKind.QA_INTERNAL);
  }

  isE2ERequired() {
    return this.data.traits.flags.includes(TaskFlag.E2E_REQUIRED);
  }

  isUnitTestRequired() {
    return this.data.traits.flags.includes(TaskFlag.UNIT_TESTS_REQUIRED);
  }

  isEpic() {
    return this.data.traits.kinds.includes(TaskKind.EPIC);
  }

  needsE2ECoverage() {
    return this.isE2E() || this.isE2ERequired();
  }

  isCriticalPriority() {
    return this.data.traits.priority === Priority.CRITICAL;
  }

  isUrgentTask() {
    const { priority, kinds } = this.data.traits;
    return (
      (priority === Priority.CRITICAL || priority === Priority.HIGH) && kinds.includes(TaskKind.BUG)
    );
  }

  currentUserEscalatedPriority() {
    return this.data.traits.priorityEscalatedByEmployee;
  }

  currentUserPushedCode() {
    return this.data.activity.mergeRequestActions.some((action) =>
      CLASSIFICATION_PUSH_ACTIONS.has(action),
    );
  }

  hasTestRelatedCommits() {
    return this.data.activity.commitTitles.some((title) =>
      CLASSIFICATION_TEST_COMMIT_PATTERN.test(title),
    );
  }

  isE2ECoverageWork() {
    if (!this.needsE2ECoverage() || !this.currentUserPushedCode()) {
      return false;
    }
    return this.isQualityAssurance() || this.hasTestRelatedCommits();
  }

  currentUserOpenedMergeRequest() {
    return this.data.activity.mergeRequestActions.includes(SourceEventAction.OPENED);
  }

  currentUserMergedMergeRequest() {
    return this.data.activity.mergeRequestActions.includes(SourceEventAction.ACCEPTED);
  }

  isMergeRequestAuthor() {
    return this.data.isMergeRequestAuthor;
  }

  isOwnMergeRequest() {
    return this.isAssignee() || this.isMergeRequestAuthor();
  }

  hasActiveWorkOnMergeRequest() {
    return this.currentUserPushedCode() || this.currentUserOpenedMergeRequest();
  }

  currentUserOpenedIssue() {
    return this.data.activity.issueActions.some((action) =>
      CLASSIFICATION_OPEN_ACTIONS.has(action),
    );
  }

  currentUserClosedIssue() {
    return this.data.activity.issueActions.includes(SourceEventAction.CLOSED);
  }

  currentUserReopenedIssue() {
    return this.data.activity.issueActions.includes(SourceEventAction.REOPENED);
  }

  currentUserCommentedOnIssue() {
    return this.data.activity.issueCommentsFromEmployee > 0;
  }

  currentUserCommentedOnMergeRequest() {
    return this.data.activity.mergeRequestCommentsFromEmployee > 0;
  }

  currentUserCommentedAnywhere() {
    return this.currentUserCommentedOnIssue() || this.currentUserCommentedOnMergeRequest();
  }

  hasReviewDialog() {
    return (
      this.currentUserCommentedOnMergeRequest() &&
      this.data.activity.mergeRequestCommentsFromOthers > 0
    );
  }

  hasReviewThreads() {
    return this.data.activity.reviewThreadCount > 0;
  }

  hasUnresolvedReviewThreads() {
    return this.data.activity.unresolvedReviewThreadCount > 0;
  }

  hasManyMergeRequestComments() {
    return this.data.activity.mergeRequestCommentsFromEmployee >= CLASSIFICATION_MANY_COMMENTS;
  }

  currentUserApproved() {
    return this.data.approvals.employeeApproved;
  }

  isApprovedByOtherUsers() {
    return this.data.approvals.otherApprovers.length > 0;
  }

  isDoing() {
    return this.hasState(WorkflowState.IN_PROGRESS);
  }

  isInReview() {
    return this.hasState(WorkflowState.REVIEW);
  }

  isAfterReview() {
    return this.hasState(WorkflowState.CHANGES_REQUESTED);
  }

  isInReviewPhase() {
    return this.isInReview() || this.isAfterReview();
  }

  isTesting() {
    return this.hasState(WorkflowState.TESTING);
  }

  isNeedInformation() {
    return this.hasState(WorkflowState.NEEDS_INFO);
  }

  wasReturnedToDoing() {
    const { currentState, previousState } = this.data.traits;
    return (
      currentState === WorkflowState.IN_PROGRESS &&
      previousState !== null &&
      CLASSIFICATION_RETURNED_FROM_STATES.has(previousState)
    );
  }

  isReadyForQa() {
    return this.hasState(WorkflowState.READY_FOR_QA);
  }

  isReturnedFromQa() {
    return this.data.traits.flags.includes(TaskFlag.RETURNED_FROM_QA);
  }

  isQaPassed() {
    return this.hasState(WorkflowState.QA_PASSED);
  }

  isQaPassedToday() {
    return this.data.traits.currentState === WorkflowState.QA_PASSED;
  }

  isInQaFlow() {
    return this.isReadyForQa() || this.isTesting() || this.isQaPassed();
  }

  isOnHold() {
    return this.hasState(WorkflowState.BLOCKED);
  }

  currentUserMarkedReadyForQa() {
    return this.setState(WorkflowState.READY_FOR_QA);
  }

  currentUserStartedTesting() {
    return this.setState(WorkflowState.TESTING);
  }

  currentUserReturnedTaskToDevelopment() {
    return this.data.traits.flagsSetByEmployee.includes(TaskFlag.RETURNED_FROM_QA);
  }

  currentUserMarkedQaPassed() {
    return this.setState(WorkflowState.QA_PASSED);
  }

  currentUserPutOnHold() {
    return this.setState(WorkflowState.BLOCKED);
  }

  currentUserPlannedTask() {
    return this.setState(WorkflowState.PLANNED);
  }

  currentUserSentToReview() {
    return this.setState(WorkflowState.REVIEW);
  }

  currentUserRequestedInformation() {
    return this.setState(WorkflowState.NEEDS_INFO);
  }

  currentUserHandedOff() {
    return this.setState(WorkflowState.HANDOFF);
  }

  currentUserReturnedToDoing() {
    return this.setState(WorkflowState.IN_PROGRESS);
  }

  currentUserResolvedRebase() {
    return this.data.traits.needsRebaseResolved && this.currentUserPushedCode();
  }

  isMergeRequestCreatedOnReportDate() {
    const createdAt = this.data.dates.mergeRequestCreatedAt;
    return (
      createdAt !== null &&
      createdAt.slice(0, CLASSIFICATION_DATE_LENGTH) ===
        this.data.dates.reportDate.slice(0, CLASSIFICATION_DATE_LENGTH)
    );
  }

  isResumedWork() {
    const lastCommitAt = this.data.dates.mergeRequestLastCommitAt;
    if (!lastCommitAt) {
      return false;
    }
    const days =
      (new Date(this.data.dates.reportDate).getTime() - new Date(lastCommitAt).getTime()) /
      CLASSIFICATION_DAY_MS;
    return days > CLASSIFICATION_RESUMED_WORK_DAYS;
  }

  isClosedWithoutMerge() {
    return this.isIssueClosedToday() && (!this.hasMergeRequest() || !this.isMergeRequestMerged());
  }

  engagementLevel() {
    this.engagement ??= this.resolveEngagement();
    return this.engagement.level;
  }

  isSecondaryContributor() {
    return this.engagementLevel() === EngagementLevel.SECONDARY;
  }

  isMinorContributor() {
    return this.engagementLevel() === EngagementLevel.MINOR;
  }

  isSupportingContributor() {
    return !this.isAssignee() && (this.isSecondaryContributor() || this.isMinorContributor());
  }

  private hasState(state: WorkflowState) {
    return this.data.traits.currentState === state || this.data.traits.activeStates.includes(state);
  }

  private setState(state: WorkflowState) {
    return this.data.traits.statesSetByEmployee.includes(state);
  }

  private resolveEngagement(): EngagementResult {
    const { activity, traits } = this.data;
    const score =
      (this.isAssignee() ? ENGAGEMENT_WEIGHTS.ASSIGNEE : 0) +
      (this.isReviewer() ? ENGAGEMENT_WEIGHTS.REVIEWER : 0) +
      (this.isMergeRequestAuthor() ? ENGAGEMENT_WEIGHTS.MERGE_REQUEST_AUTHOR : 0) +
      (this.currentUserMergedMergeRequest() ? ENGAGEMENT_WEIGHTS.MERGED : 0) +
      (this.currentUserOpenedIssue() ? ENGAGEMENT_WEIGHTS.ISSUE_AUTHOR : 0) +
      (traits.priorityEscalatedByEmployee ? ENGAGEMENT_WEIGHTS.PRIORITY_ESCALATION : 0) +
      Math.min(activity.mergeRequestCommitCount, ENGAGEMENT_COMMIT_CAP) *
        ENGAGEMENT_WEIGHTS.PER_COMMIT +
      Math.min(
        activity.issueCommentsFromEmployee + activity.mergeRequestCommentsFromEmployee,
        ENGAGEMENT_COMMENT_CAP,
      ) *
        ENGAGEMENT_WEIGHTS.PER_COMMENT +
      Math.min(traits.statesSetByEmployee.length, ENGAGEMENT_STATE_CHANGE_CAP) *
        ENGAGEMENT_WEIGHTS.PER_STATE_CHANGE;
    return { score, level: this.toEngagementLevel(score) };
  }

  private toEngagementLevel(score: number) {
    if (score >= ENGAGEMENT_THRESHOLDS.PRIMARY) {
      return EngagementLevel.PRIMARY;
    }
    if (score >= ENGAGEMENT_THRESHOLDS.SECONDARY) {
      return EngagementLevel.SECONDARY;
    }
    if (score >= ENGAGEMENT_THRESHOLDS.MINOR) {
      return EngagementLevel.MINOR;
    }
    return EngagementLevel.OBSERVER;
  }
}
