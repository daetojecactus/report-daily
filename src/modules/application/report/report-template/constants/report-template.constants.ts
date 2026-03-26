import { TaskStatus } from '../../../../../common/enums/task.enum';
import type { Locale } from '../../../../../common/i18n/i18n.types';

//секция QA-отчёта
export interface QaSection {
  titleKey: (locale: Locale) => string;
  statuses: Set<TaskStatus>;
}

//секции QA-отчёта: задачи группируются по типу работы
export const QA_SECTIONS: QaSection[] = [
  {
    titleKey: (locale) => locale.report.qaReviewed,
    statuses: new Set([
      TaskStatus.STARTED_TESTING,
      TaskStatus.TESTED_AND_APPROVED,
      TaskStatus.TESTED_WITH_COMMENTS,
      TaskStatus.APPROVED_AFTER_REWORK,
      TaskStatus.VERIFIED_FIX,
      TaskStatus.APPROVED_MR,
      TaskStatus.APPROVED_AND_MERGED,
      TaskStatus.APPROVED_FIXES,
      TaskStatus.REVIEW_COMMENT,
      TaskStatus.REQUESTED_CHANGES,
      TaskStatus.MERGED_OTHERS_WORK,
      TaskStatus.RE_REVIEWED_AND_APPROVED,
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
      TaskStatus.RETURNED_FOR_REVISION,
      TaskStatus.CREATED_TASK,
      TaskStatus.FOUND_BUG_DURING_WORK,
      TaskStatus.REPORTED_BUG,
      TaskStatus.REOPENED_BUG,
      TaskStatus.REGRESSION_FOUND,
      TaskStatus.BLOCKED_RELEASE,
    ]),
  },
  {
    titleKey: (locale) => locale.report.qaAutoTests,
    statuses: new Set([TaskStatus.WROTE_TESTS]),
  },
];
