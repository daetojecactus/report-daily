import { JobRole } from 'src/modules/application/user/user.enums';
import { ReportPreset } from '../report.enums';

export const REPORT_ROLE_PRESETS: Record<JobRole, ReportPreset> = {
  [JobRole.DEVELOPER]: ReportPreset.STANDARD,
  [JobRole.QA]: ReportPreset.QA,
  [JobRole.PROJECT_MANAGER]: ReportPreset.STANDARD,
  [JobRole.SYSTEM_ANALYST]: ReportPreset.ANALYST,
  [JobRole.DEVOPS]: ReportPreset.STANDARD,
};
