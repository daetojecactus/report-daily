import { TaskStatus } from '../../../../../common/enums/task.enum';
import type { Locale } from '../../../../../common/i18n/i18n.types';

//секция QA-отчёта
export interface QaSection {
  titleKey: (locale: Locale) => string;
  statuses: Set<TaskStatus>;
}

//секции QA-отчёта: задачи группируются по типу работы, порядок = приоритет попадания
export const QA_SECTIONS: QaSection[] = [
  {
    titleKey: (locale) => locale.report.qaReturns,
    statuses: new Set([
      TaskStatus.QA_RETURNED_TO_DEV,
      TaskStatus.RETURNED_FOR_REVISION,
      TaskStatus.REOPENED_BUG,
      TaskStatus.BLOCKED_RELEASE,
      TaskStatus.TASK_RETURNED_FROM_QA,
    ]),
  },
  {
    titleKey: (locale) => locale.report.qaTesting,
    statuses: new Set([
      TaskStatus.QA_IN_PROGRESS,
      TaskStatus.STARTED_TESTING,
      TaskStatus.TESTED_WITH_COMMENTS,
      TaskStatus.QA_AWAITING_TESTING,
      TaskStatus.TASK_IN_QA_TESTING,
      TaskStatus.TASK_SENT_TO_QA,
    ]),
  },
  {
    titleKey: (locale) => locale.report.qaReviewed,
    statuses: new Set([
      TaskStatus.TESTED_AND_APPROVED,
      TaskStatus.APPROVED_AFTER_REWORK,
      TaskStatus.VERIFIED_FIX,
      TaskStatus.APPROVED_MR,
      TaskStatus.APPROVED_AND_MERGED,
      TaskStatus.APPROVED_FIXES,
      TaskStatus.REVIEW_COMMENT,
      TaskStatus.REQUESTED_CHANGES,
      TaskStatus.MERGED_OTHERS_WORK,
      TaskStatus.RE_REVIEWED_AND_APPROVED,
      TaskStatus.DEV_PASSED_QA,
      TaskStatus.STARTED,
      TaskStatus.CONTINUED,
      TaskStatus.COMMENTED,
    ]),
  },
  {
    titleKey: (locale) => locale.report.qaBugs,
    statuses: new Set([
      TaskStatus.FOUND_BUG,
      TaskStatus.CLARIFIED_BUG,
      TaskStatus.CREATED,
      TaskStatus.FOUND_BUG_DURING_WORK,
      TaskStatus.REPORTED_BUG,
      TaskStatus.REGRESSION_FOUND,
    ]),
  },
  {
    titleKey: (locale) => locale.report.qaAutoTests,
    statuses: new Set([
      TaskStatus.WROTE_TESTS,
      TaskStatus.QA_E2E_COVERAGE_ADDED,
      TaskStatus.QA_AUTOMATION_DEVELOPED,
      TaskStatus.QA_AUTOMATION_MAINTAINED,
      TaskStatus.QA_TEST_ENVIRONMENT_SETUP,
      TaskStatus.QA_INTERNAL_TASK,
    ]),
  },
];
