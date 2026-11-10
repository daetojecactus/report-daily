import { ActivityDetail } from '../activity/activity.enums';
import { ReportStatus } from '../report.enums';

export const REPORT_REUSABLE_STATUSES = [
  ReportStatus.READY,
  ReportStatus.DELIVERED,
  ReportStatus.EMPTY,
];

export const REPORT_SNAPSHOT_STATUSES = [ReportStatus.READY, ReportStatus.DELIVERED];

export const REPORT_RETENTION_DAYS = 30;

export const REPORT_AI_NAME_DETAILS = [ActivityDetail.LABELS, ActivityDetail.STATUS];
