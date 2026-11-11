import { Injectable } from '@nestjs/common';
import type { UserSource } from 'src/modules/application/user/user-source/types/user-source.interface';
import { SOURCE_NAME_FACTS } from './constants/source.constants';
import { GitLabSourceService } from './gitlab/gitlab-source.service';
import { Source } from './types/source.enums';
import type {
  ActivitySource,
  GroupedDailyData,
  GroupedIssue,
  GroupedMergeRequest,
} from './types/source.interface';

@Injectable()
export class SourceService {
  private readonly sources: Record<Source, ActivitySource>;

  constructor(gitlabSourceService: GitLabSourceService) {
    this.sources = { [Source.GITLAB]: gitlabSourceService };
  }

  collect(account: UserSource, date: string, timeZone: string) {
    return this.sources[account.source].collect(account, date, timeZone);
  }

  findNames(day: GroupedDailyData) {
    const items: (GroupedIssue | GroupedMergeRequest)[] = [
      ...day.issues.flatMap((issue) => [issue, ...issue.mergeRequests]),
      ...day.standaloneMergeRequests,
    ];
    const names = items.flatMap((item) => [
      ...item.labels,
      ...item.startOfDay.labels,
      ...('status' in item && item.status ? [item.status] : []),
      ...(item.startOfDay.status ? [item.startOfDay.status] : []),
      ...item.facts
        .filter((fact) => SOURCE_NAME_FACTS.has(fact.kind) && fact.value)
        .map((fact) => fact.value ?? ''),
    ]);
    return [...new Set(names)];
  }
}
