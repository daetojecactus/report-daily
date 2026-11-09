import type {
  ActivityResult,
  ActivitySummary,
} from 'src/modules/application/report/activity/activity.interface';
import type { GroupedDailyData } from 'src/modules/application/source/source.interface';
import type { JobRole } from 'src/modules/application/user/user.enums';

export interface PreviewAliases {
  users: Map<string, string>;
  projects: Map<number, number>;
  labels: Map<string, string>;
  statuses: Map<string, string>;
  branches: Map<string, string>;
  tags: Map<string, string>;
  milestones: Map<string, string>;
  iterations: Map<string, string>;
  pages: Map<string, string>;
  commits: Map<string, string>;
  commitTitles: Map<string, string>;
}

export interface PreviewFixture {
  role: JobRole;
  username: string;
  date: string;
  timeZone: string;
  day: GroupedDailyData;
}

export interface PreviewFixtureFile {
  name: string;
  fixture: PreviewFixture;
}

export interface PreviewTexts {
  lines: Map<ActivityResult, string>;
  summaries: Map<ActivitySummary, string>;
}
