import { Injectable } from '@nestjs/common';
import type { TaskContext } from './classification.context';
import { ActivityAction } from './classification.enums';
import { DeveloperRules } from './rules/developer.rules';
import { ManagerRules } from './rules/manager.rules';
import { QaInternalRules } from './rules/qa-internal.rules';
import { QaRules } from './rules/qa.rules';

@Injectable()
export class ClassificationResolver {
  constructor(
    private readonly managerRules: ManagerRules,
    private readonly qaRules: QaRules,
    private readonly developerRules: DeveloperRules,
    private readonly qaInternalRules: QaInternalRules,
  ) {}

  resolve(context: TaskContext): ActivityAction {
    if (
      context.currentUserPutOnHold() &&
      !context.currentUserClosedIssue() &&
      !context.currentUserMergedMergeRequest()
    ) {
      return ActivityAction.PUT_ON_HOLD;
    }
    if (context.isNonEngineeringRole()) {
      return this.managerRules.resolve(context);
    }
    if (context.currentUserMergedMergeRequest()) {
      return this.resolveMerge(context);
    }
    if (context.isQualityAssurance()) {
      return this.qaRules.resolve(context);
    }
    return this.developerRules.resolve(context);
  }

  private resolveMerge(context: TaskContext) {
    if (!context.isOwnMergeRequest()) {
      return context.currentUserApproved()
        ? ActivityAction.APPROVED_AND_MERGED
        : ActivityAction.MERGED_OTHERS_WORK;
    }
    if (
      context.needsE2ECoverage() &&
      (context.isQualityAssurance() || context.hasTestRelatedCommits())
    ) {
      return ActivityAction.QA_E2E_COVERAGE_ADDED;
    }
    if (context.isQaInternalTask()) {
      return this.qaInternalRules.resolve(context, true);
    }
    if (
      context.isHotfix() ||
      (context.isStandaloneMergeRequest() &&
        (context.isCriticalPriority() || context.isUrgentTask()))
    ) {
      return ActivityAction.HOTFIX_DEPLOYED;
    }
    if (context.isBug()) {
      return ActivityAction.FIXED_BUG;
    }
    return context.isFeature()
      ? ActivityAction.IMPLEMENTED_FEATURE
      : ActivityAction.COMPLETED_BY_MERGE;
  }
}
