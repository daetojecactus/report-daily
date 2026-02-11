import { Injectable } from '@nestjs/common';
import {
  GroupedDailyData,
  GroupedIssue,
  GroupedMergeRequest,
  StandaloneMergeRequest,
  StandalonePush,
} from './git-report.interface';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import {
  GitLabEvent,
  GitLabIssue,
  GitLabMergeRequest,
} from 'src/modules/vendors/gitlab/gitlab.types';
import {
  GitLabNoteableType,
  GitLabTargetType,
  ParsedEventType,
} from 'src/common/enums/gitlab.enum';
import { GIT_REPORT_BRANCH_ISSUE_PATTERN } from './constants/git-report.constants';

@Injectable()
export class GitReportService {
  constructor(private readonly gitlabService: GitLabService) {}

  //собирает и группирует все события пользователя за день
  async collectAndGroupDailyEvents(userId: number, date: string) {
    const events = await this.gitlabService.getEvents(date, userId);

    const { issueKeys, mrKeys } = this.extractUniqueKeys(events);

    const [issuesMap, mrsMap] = await Promise.all([
      this.fetchIssueDetails(issueKeys),
      this.fetchMergeRequestDetails(mrKeys),
    ]);

    const mrToIssueLinks = this.linkMergeRequestsToIssues(mrsMap, issuesMap);

    return this.buildGroupedData(events, issuesMap, mrsMap, mrToIssueLinks);
  }

  //извлекает уникальные ключи задач и мр из событий
  private extractUniqueKeys(events: GitLabEvent[]) {
    const issueKeys = new Set<string>();
    const mrKeys = new Set<string>();

    for (const event of events) {
      const parsed = this.detectEventType(event);

      if (parsed.type === ParsedEventType.ISSUE && parsed.iid) {
        issueKeys.add(this.toKey(parsed.projectId, parsed.iid));
      } else if (parsed.type === ParsedEventType.MERGE_REQUEST && parsed.iid) {
        mrKeys.add(this.toKey(parsed.projectId, parsed.iid));
      }
    }

    return { issueKeys, mrKeys };
  }

  //определяет тип события (задача, мр, пуш)
  private detectEventType(event: GitLabEvent) {
    const projectId = event.project_id;

    if (this.isIssueRelated(event)) {
      const iid = event.target_iid ?? event.note?.noteable_iid;
      return { type: ParsedEventType.ISSUE, projectId, iid };
    }

    if (this.isMergeRequestRelated(event)) {
      const iid = event.target_iid ?? event.note?.noteable_iid;
      return { type: ParsedEventType.MERGE_REQUEST, projectId, iid };
    }

    if (event.push_data) {
      return {
        type: ParsedEventType.PUSH,
        projectId,
        branch: event.push_data.ref,
      };
    }

    return { type: ParsedEventType.UNKNOWN, projectId };
  }

  //проверяет связано ли событие с задачей
  private isIssueRelated(event: GitLabEvent): boolean {
    return (
      event.target_type === GitLabTargetType.ISSUE ||
      (event.target_type === GitLabTargetType.NOTE &&
        event.note?.noteable_type === GitLabNoteableType.ISSUE)
    );
  }

  //проверяет связано ли событие с мр
  private isMergeRequestRelated(event: GitLabEvent): boolean {
    return (
      event.target_type === GitLabTargetType.MERGE_REQUEST ||
      (event.target_type === GitLabTargetType.NOTE &&
        event.note?.noteable_type === GitLabNoteableType.MERGE_REQUEST) ||
      (event.target_type === GitLabTargetType.DIFF_NOTE &&
        event.note?.noteable_type === GitLabNoteableType.MERGE_REQUEST)
    );
  }

  //формирует уникальный ключ из projectId и iid
  private toKey(projectId: number, iid: number): string {
    return `${projectId}_${iid}`;
  }

  //парсит ключ обратно в projectId и iid
  private fromKey(key: string) {
    const [projectId, iid] = key.split('_').map(Number);
    return { projectId, iid };
  }

  //загружает детальную информацию о задачах
  private async fetchIssueDetails(keys: Set<string>) {
    const map = new Map<string, GitLabIssue>();

    await Promise.all(
      Array.from(keys).map(async (key) => {
        const { projectId, iid } = this.fromKey(key);
        const issue = await this.gitlabService.getIssue(projectId, iid);
        if (issue) map.set(key, issue);
      }),
    );

    return map;
  }

  //загружает детальную информацию о мр
  private async fetchMergeRequestDetails(keys: Set<string>) {
    const map = new Map<string, GitLabMergeRequest>();

    await Promise.all(
      Array.from(keys).map(async (key) => {
        const { projectId, iid } = this.fromKey(key);
        const mr = await this.gitlabService.getMergeRequest(projectId, iid);
        if (mr) map.set(key, mr);
      }),
    );

    return map;
  }

  //связывает мр с задачами по номеру в названии ветки
  private linkMergeRequestsToIssues(
    mrsMap: Map<string, GitLabMergeRequest>,
    issuesMap: Map<string, GitLabIssue>,
  ) {
    const links = new Map<string, string>();

    for (const [mrKey, mr] of mrsMap) {
      const issueIid = this.extractIssueIdFromBranch(mr.source_branch);
      if (!issueIid) continue;

      const issueKey = this.toKey(mr.project_id, issueIid);
      if (issuesMap.has(issueKey)) {
        links.set(mrKey, issueKey);
      }
    }

    return links;
  }

  //извлекает номер задачи из названия ветки (101-feat-update -> 101)
  private extractIssueIdFromBranch(branchName: string): number | null {
    const match = branchName.match(GIT_REPORT_BRANCH_ISSUE_PATTERN);
    return match ? parseInt(match[1], 10) : null;
  }

  //собирает сгруппированные данные из событий
  private buildGroupedData(
    events: GitLabEvent[],
    issuesMap: Map<string, GitLabIssue>,
    mrsMap: Map<string, GitLabMergeRequest>,
    mrToIssueLinks: Map<string, string>,
  ): GroupedDailyData {
    const eventsByIssue = this.initializeEventsMap(issuesMap.keys());
    const eventsByMr = this.initializeEventsMap(mrsMap.keys());
    const eventsByPush = new Map<string, GitLabEvent[]>();

    this.distributeEvents(events, eventsByIssue, eventsByMr, eventsByPush);

    return {
      issues: this.assembleGroupedIssues(
        issuesMap,
        eventsByIssue,
        mrsMap,
        eventsByMr,
        mrToIssueLinks,
      ),
      standaloneMergeRequests: this.assembleStandaloneMergeRequests(
        mrsMap,
        eventsByMr,
        mrToIssueLinks,
      ),
      standalonePushes: this.assembleStandalonePushes(eventsByPush, mrsMap),
    };
  }

  //инициализирует пустые массивы событий для каждого ключа
  private initializeEventsMap(keys: IterableIterator<string>) {
    const map = new Map<string, GitLabEvent[]>();
    for (const key of keys) {
      map.set(key, []);
    }
    return map;
  }

  //распределяет события по задачам, мр и пушам
  private distributeEvents(
    events: GitLabEvent[],
    eventsByIssue: Map<string, GitLabEvent[]>,
    eventsByMr: Map<string, GitLabEvent[]>,
    eventsByPush: Map<string, GitLabEvent[]>,
  ) {
    for (const event of events) {
      const parsed = this.detectEventType(event);

      if (parsed.type === ParsedEventType.ISSUE && parsed.iid) {
        eventsByIssue
          .get(this.toKey(parsed.projectId, parsed.iid))
          ?.push(event);
      } else if (parsed.type === ParsedEventType.MERGE_REQUEST && parsed.iid) {
        eventsByMr.get(this.toKey(parsed.projectId, parsed.iid))?.push(event);
      } else if (parsed.type === ParsedEventType.PUSH && parsed.branch) {
        const key = `${parsed.projectId}_${parsed.branch}`;
        const existing = eventsByPush.get(key) ?? [];
        existing.push(event);
        eventsByPush.set(key, existing);
      }
    }
  }

  //собирает задачи с вложенными мр
  private assembleGroupedIssues(
    issuesMap: Map<string, GitLabIssue>,
    eventsByIssue: Map<string, GitLabEvent[]>,
    mrsMap: Map<string, GitLabMergeRequest>,
    eventsByMr: Map<string, GitLabEvent[]>,
    mrToIssueLinks: Map<string, string>,
  ): GroupedIssue[] {
    return Array.from(issuesMap.entries()).map(([issueKey, issue]) => ({
      projectId: issue.project_id,
      iid: issue.iid,
      title: issue.title,
      state: issue.state as GroupedIssue['state'],
      webUrl: issue.web_url,
      labels: issue.labels,
      events: eventsByIssue.get(issueKey) ?? [],
      mergeRequests: this.findRelatedMergeRequests(
        issueKey,
        mrsMap,
        eventsByMr,
        mrToIssueLinks,
      ),
    }));
  }

  //находит мр связанные с задачей
  private findRelatedMergeRequests(
    issueKey: string,
    mrsMap: Map<string, GitLabMergeRequest>,
    eventsByMr: Map<string, GitLabEvent[]>,
    mrToIssueLinks: Map<string, string>,
  ): GroupedMergeRequest[] {
    const related: GroupedMergeRequest[] = [];

    for (const [mrKey, linkedIssueKey] of mrToIssueLinks) {
      if (linkedIssueKey !== issueKey) continue;

      const mr = mrsMap.get(mrKey)!;
      related.push({
        projectId: mr.project_id,
        iid: mr.iid,
        title: mr.title,
        state: mr.state as GroupedMergeRequest['state'],
        webUrl: mr.web_url,
        sourceBranch: mr.source_branch,
        labels: mr.labels,
        events: eventsByMr.get(mrKey) ?? [],
      });
    }

    return related;
  }

  //собирает мр без привязки к задачам
  private assembleStandaloneMergeRequests(
    mrsMap: Map<string, GitLabMergeRequest>,
    eventsByMr: Map<string, GitLabEvent[]>,
    mrToIssueLinks: Map<string, string>,
  ): StandaloneMergeRequest[] {
    return Array.from(mrsMap.entries())
      .filter(([mrKey]) => !mrToIssueLinks.has(mrKey))
      .map(([mrKey, mr]) => ({
        projectId: mr.project_id,
        iid: mr.iid,
        title: mr.title,
        state: mr.state as StandaloneMergeRequest['state'],
        webUrl: mr.web_url,
        sourceBranch: mr.source_branch,
        labels: mr.labels,
        events: eventsByMr.get(mrKey) ?? [],
      }));
  }

  //собирает пуши без привязки к мр
  private assembleStandalonePushes(
    eventsByPush: Map<string, GitLabEvent[]>,
    mrsMap: Map<string, GitLabMergeRequest>,
  ): StandalonePush[] {
    const mrBranches = new Set(
      Array.from(mrsMap.values()).map(
        (mr) => `${mr.project_id}_${mr.source_branch}`,
      ),
    );

    return Array.from(eventsByPush.entries())
      .filter(([key]) => !mrBranches.has(key))
      .map(([key, events]) => {
        const [projectId, ...branchParts] = key.split('_');
        return {
          projectId: parseInt(projectId, 10),
          branch: branchParts.join('_'),
          events,
        };
      });
  }
}
