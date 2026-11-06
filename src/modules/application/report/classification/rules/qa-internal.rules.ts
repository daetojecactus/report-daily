import { Injectable } from '@nestjs/common';
import type { TaskContext } from '../classification.context';
import { ActivityAction } from '../classification.enums';

@Injectable()
export class QaInternalRules {
  resolve(context: TaskContext, hasCodeWork = context.currentUserPushedCode()) {
    if (context.needsE2ECoverage() && hasCodeWork) {
      return ActivityAction.QA_E2E_COVERAGE_ADDED;
    }
    if (hasCodeWork && (context.isMaintenance() || context.isBug())) {
      return ActivityAction.QA_AUTOMATION_MAINTAINED;
    }
    if (hasCodeWork) {
      return ActivityAction.QA_AUTOMATION_DEVELOPED;
    }
    if (context.currentUserSentToReview()) {
      return ActivityAction.SENT_TO_REVIEW;
    }
    if (context.isMaintenance()) {
      return ActivityAction.QA_TEST_ENVIRONMENT_SETUP;
    }
    return ActivityAction.QA_INTERNAL_TASK;
  }
}
