import { Injectable } from '@nestjs/common';
import { GroupedDailyData } from './git-group.interface';
import { GitGroupFetcher } from './git-group.fetcher';
import { GitGroupBuilder } from './git-group.builder';
import {
  collectPushBranches,
  extractUniqueKeys,
} from './git-group.event-parser';

//оркестратор: собирает и группирует все события пользователя за день
@Injectable()
export class GitGroupService {
  constructor(
    private readonly fetcher: GitGroupFetcher,
    private readonly builder: GitGroupBuilder,
  ) {}

  //собирает и группирует все события пользователя за день
  async collectAndGroupDailyEvents(
    userId: number,
    date: string,
  ): Promise<GroupedDailyData> {
    const events = await this.fetcher.fetchEvents(userId, date);

    const { issueKeys, mrKeys } = extractUniqueKeys(events);

    const [issuesMap, mrsMap] = await Promise.all([
      this.fetcher.fetchIssueDetails(issueKeys),
      this.fetcher.fetchMergeRequestDetails(mrKeys),
    ]);

    const mrToIssueLinks = this.fetcher.linkMergeRequestsToIssues(
      mrsMap,
      issuesMap,
    );

    //подтягиваем задачи для осиротевших мр (когда задача не попала в events)
    await this.fetcher.resolveOrphanMergeRequests(
      mrsMap,
      issuesMap,
      mrToIssueLinks,
    );

    //подтягиваем мр и задачи для пушей в feature-ветки
    const pushBranches = collectPushBranches(events);
    await this.fetcher.resolvePushBranches(
      pushBranches,
      mrsMap,
      issuesMap,
      mrToIssueLinks,
      mrKeys,
    );

    //загружаем комментарии, историю лейблов, историю состояний и коммиты для задач и мр
    const [
      issueNotesMap,
      issueLabelEventsMap,
      mrNotesMap,
      mrLabelEventsMap,
      issueStateEventsMap,
      mrStateEventsMap,
      mrCommitsMap,
    ] = await Promise.all([
      this.fetcher.fetchNotesForIssues(issuesMap),
      this.fetcher.fetchLabelEventsForIssues(issuesMap),
      this.fetcher.fetchNotesForMRs(mrsMap),
      this.fetcher.fetchLabelEventsForMRs(mrsMap),
      this.fetcher.fetchStateEventsForIssues(issuesMap),
      this.fetcher.fetchStateEventsForMRs(mrsMap),
      this.fetcher.fetchCommitsForMRs(mrsMap),
    ]);

    return this.builder.buildGroupedData(
      events,
      issuesMap,
      mrsMap,
      mrToIssueLinks,
      issueNotesMap,
      issueLabelEventsMap,
      mrNotesMap,
      mrLabelEventsMap,
      issueStateEventsMap,
      mrStateEventsMap,
      mrCommitsMap,
      date,
    );
  }
}
