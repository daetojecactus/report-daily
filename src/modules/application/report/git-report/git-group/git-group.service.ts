import { Injectable } from '@nestjs/common';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import {
  GitLabEvent,
  GitLabIssue,
  GitLabLabelEvent,
  GitLabMergeRequest,
  GitLabNote,
} from 'src/modules/vendors/gitlab/gitlab.types';
import {
  GitLabNoteableType,
  GitLabTargetType,
  MainBranch,
  ParsedEventType,
} from 'src/common/enums/gitlab.enum';
import { GIT_REPORT_BRANCH_ISSUE_PATTERN } from '../constants/git-report.constants';
import {
  CleanEvent,
  CleanLabelEvent,
  CleanNote,
  GroupedDailyData,
  GroupedIssue,
  GroupedMergeRequest,
  StandaloneMergeRequest,
  StandalonePush,
} from './git-group.interface';

@Injectable()
export class GitGroupService {
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

    //подтягиваем задачи для осиротевших мр (когда задача не попала в events)
    await this.resolveOrphanMergeRequests(mrsMap, issuesMap, mrToIssueLinks);

    //подтягиваем мр и задачи для пушей в feature-ветки
    const pushBranches = this.collectPushBranches(events);
    await this.resolvePushBranches(
      pushBranches,
      mrsMap,
      issuesMap,
      mrToIssueLinks,
      mrKeys,
    );

    //загружаем комментарии и историю лейблов для задач и мр
    const [issueNotesMap, issueLabelEventsMap, mrNotesMap, mrLabelEventsMap] =
      await Promise.all([
        this.fetchNotesForIssues(issuesMap),
        this.fetchLabelEventsForIssues(issuesMap),
        this.fetchNotesForMRs(mrsMap),
        this.fetchLabelEventsForMRs(mrsMap),
      ]);

    return this.buildGroupedData(
      events,
      issuesMap,
      mrsMap,
      mrToIssueLinks,
      issueNotesMap,
      issueLabelEventsMap,
      mrNotesMap,
      mrLabelEventsMap,
      date,
    );
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

  //подтягивает задачи для мр у которых есть номер задачи в ветке, но задача не попала в events
  private async resolveOrphanMergeRequests(
    mrsMap: Map<string, GitLabMergeRequest>,
    issuesMap: Map<string, GitLabIssue>,
    mrToIssueLinks: Map<string, string>,
  ) {
    const orphanMrs = Array.from(mrsMap.entries()).filter(
      ([mrKey]) => !mrToIssueLinks.has(mrKey),
    );

    await Promise.all(
      orphanMrs.map(async ([mrKey, mr]) => {
        const issueIid = this.extractIssueIdFromBranch(mr.source_branch);
        if (!issueIid) return;

        const issueKey = this.toKey(mr.project_id, issueIid);
        if (issuesMap.has(issueKey)) return;

        const issue = await this.gitlabService.getIssue(
          mr.project_id,
          issueIid,
        );
        if (issue) {
          issuesMap.set(issueKey, issue);
          mrToIssueLinks.set(mrKey, issueKey);
        }
      }),
    );
  }

  //собирает уникальные feature-ветки из пуш-событий (не main/master/develop)
  private collectPushBranches(
    events: GitLabEvent[],
  ): { projectId: number; branch: string }[] {
    const mainBranches = new Set(Object.values(MainBranch) as string[]);
    const seen = new Set<string>();
    const result: { projectId: number; branch: string }[] = [];

    for (const event of events) {
      if (!event.push_data?.ref) continue;
      const branch = event.push_data.ref;
      if (mainBranches.has(branch)) continue;

      const key = `${event.project_id}_${branch}`;
      if (seen.has(key)) continue;
      seen.add(key);

      result.push({ projectId: event.project_id, branch });
    }

    return result;
  }

  //подтягивает мр и задачи для пушей в feature-ветки без привязки
  private async resolvePushBranches(
    pushBranches: { projectId: number; branch: string }[],
    mrsMap: Map<string, GitLabMergeRequest>,
    issuesMap: Map<string, GitLabIssue>,
    mrToIssueLinks: Map<string, string>,
    existingMrKeys: Set<string>,
  ) {
    await Promise.all(
      pushBranches.map(async ({ projectId, branch }) => {
        //проверяем, есть ли уже мр для этой ветки
        const hasExistingMr = Array.from(mrsMap.values()).some(
          (mr) => mr.project_id === projectId && mr.source_branch === branch,
        );
        if (hasExistingMr) return;

        //ищем мр по ветке
        const mr = await this.gitlabService.getMergeRequestByBranch(
          projectId,
          branch,
        );
        if (!mr) return;

        const mrKey = this.toKey(projectId, mr.iid);
        if (existingMrKeys.has(mrKey)) return;

        mrsMap.set(mrKey, mr);

        //пробуем найти задачу по номеру из ветки
        const issueIid = this.extractIssueIdFromBranch(branch);
        if (!issueIid) return;

        const issueKey = this.toKey(projectId, issueIid);
        if (issuesMap.has(issueKey)) {
          mrToIssueLinks.set(mrKey, issueKey);
          return;
        }

        const issue = await this.gitlabService.getIssue(projectId, issueIid);
        if (issue) {
          issuesMap.set(issueKey, issue);
          mrToIssueLinks.set(mrKey, issueKey);
        }
      }),
    );
  }

  //загружает комментарии для всех задач
  private async fetchNotesForIssues(issuesMap: Map<string, GitLabIssue>) {
    const map = new Map<string, GitLabNote[]>();

    await Promise.all(
      Array.from(issuesMap.entries()).map(async ([key, issue]) => {
        const notes = await this.gitlabService.getIssueNotes(
          issue.project_id,
          issue.iid,
        );
        map.set(key, notes);
      }),
    );

    return map;
  }

  //загружает историю лейблов для всех задач
  private async fetchLabelEventsForIssues(issuesMap: Map<string, GitLabIssue>) {
    const map = new Map<string, GitLabLabelEvent[]>();

    await Promise.all(
      Array.from(issuesMap.entries()).map(async ([key, issue]) => {
        const events = await this.gitlabService.getIssueLabelEvents(
          issue.project_id,
          issue.iid,
        );
        map.set(key, events);
      }),
    );

    return map;
  }

  //загружает комментарии для всех мр
  private async fetchNotesForMRs(mrsMap: Map<string, GitLabMergeRequest>) {
    const map = new Map<string, GitLabNote[]>();

    await Promise.all(
      Array.from(mrsMap.entries()).map(async ([key, mr]) => {
        const notes = await this.gitlabService.getMergeRequestNotes(
          mr.project_id,
          mr.iid,
        );
        map.set(key, notes);
      }),
    );

    return map;
  }

  //загружает историю лейблов для всех мр
  private async fetchLabelEventsForMRs(
    mrsMap: Map<string, GitLabMergeRequest>,
  ) {
    const map = new Map<string, GitLabLabelEvent[]>();

    await Promise.all(
      Array.from(mrsMap.entries()).map(async ([key, mr]) => {
        const events = await this.gitlabService.getMergeRequestLabelEvents(
          mr.project_id,
          mr.iid,
        );
        map.set(key, events);
      }),
    );

    return map;
  }

  //собирает сгруппированные данные из событий
  private buildGroupedData(
    events: GitLabEvent[],
    issuesMap: Map<string, GitLabIssue>,
    mrsMap: Map<string, GitLabMergeRequest>,
    mrToIssueLinks: Map<string, string>,
    issueNotesMap: Map<string, GitLabNote[]>,
    issueLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    mrNotesMap: Map<string, GitLabNote[]>,
    mrLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    date: string,
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
        issueNotesMap,
        issueLabelEventsMap,
        mrNotesMap,
        mrLabelEventsMap,
        date,
      ),
      standaloneMergeRequests: this.assembleStandaloneMergeRequests(
        mrsMap,
        eventsByMr,
        mrToIssueLinks,
        mrNotesMap,
        mrLabelEventsMap,
        date,
      ),
      standalonePushes: this.assembleStandalonePushes(
        eventsByPush,
        mrsMap,
        date,
      ),
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
    issueNotesMap: Map<string, GitLabNote[]>,
    issueLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    mrNotesMap: Map<string, GitLabNote[]>,
    mrLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    date: string,
  ): GroupedIssue[] {
    return Array.from(issuesMap.entries()).map(([issueKey, issue]) => ({
      projectId: issue.project_id,
      iid: issue.iid,
      title: issue.title,
      state: issue.state as GroupedIssue['state'],
      webUrl: issue.web_url,
      labels: issue.labels,
      createdAt: issue.created_at,
      assignee: issue.assignee?.username ?? null,
      events: this.cleanEvents(eventsByIssue.get(issueKey) ?? [], date),
      notes: this.cleanNotes(issueNotesMap.get(issueKey) ?? [], date),
      labelEvents: this.cleanLabelEvents(
        issueLabelEventsMap.get(issueKey) ?? [],
        date,
      ),
      mergeRequests: this.findRelatedMergeRequests(
        issueKey,
        mrsMap,
        eventsByMr,
        mrToIssueLinks,
        mrNotesMap,
        mrLabelEventsMap,
        date,
      ),
    }));
  }

  //находит мр связанные с задачей
  private findRelatedMergeRequests(
    issueKey: string,
    mrsMap: Map<string, GitLabMergeRequest>,
    eventsByMr: Map<string, GitLabEvent[]>,
    mrToIssueLinks: Map<string, string>,
    mrNotesMap: Map<string, GitLabNote[]>,
    mrLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    date: string,
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
        createdAt: mr.created_at,
        assignee: mr.assignee?.username ?? null,
        reviewers: mr.reviewers?.map((r) => r.username) ?? [],
        events: this.cleanEvents(eventsByMr.get(mrKey) ?? [], date),
        notes: this.cleanNotes(mrNotesMap.get(mrKey) ?? [], date),
        labelEvents: this.cleanLabelEvents(
          mrLabelEventsMap.get(mrKey) ?? [],
          date,
        ),
      });
    }

    return related;
  }

  //собирает мр без привязки к задачам
  private assembleStandaloneMergeRequests(
    mrsMap: Map<string, GitLabMergeRequest>,
    eventsByMr: Map<string, GitLabEvent[]>,
    mrToIssueLinks: Map<string, string>,
    mrNotesMap: Map<string, GitLabNote[]>,
    mrLabelEventsMap: Map<string, GitLabLabelEvent[]>,
    date: string,
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
        createdAt: mr.created_at,
        assignee: mr.assignee?.username ?? null,
        reviewers: mr.reviewers?.map((r) => r.username) ?? [],
        events: this.cleanEvents(eventsByMr.get(mrKey) ?? [], date),
        notes: this.cleanNotes(mrNotesMap.get(mrKey) ?? [], date),
        labelEvents: this.cleanLabelEvents(
          mrLabelEventsMap.get(mrKey) ?? [],
          date,
        ),
      }));
  }

  //собирает пуши без привязки к мр (исключает main/master/develop)
  private assembleStandalonePushes(
    eventsByPush: Map<string, GitLabEvent[]>,
    mrsMap: Map<string, GitLabMergeRequest>,
    date: string,
  ): StandalonePush[] {
    const mrBranches = new Set(
      Array.from(mrsMap.values()).map(
        (mr) => `${mr.project_id}_${mr.source_branch}`,
      ),
    );
    const mainBranches = new Set(Object.values(MainBranch) as string[]);

    return Array.from(eventsByPush.entries())
      .filter(([key]) => {
        if (mrBranches.has(key)) return false;
        const [, ...branchParts] = key.split('_');
        const branch = branchParts.join('_');
        //фильтруем пуши в main/master/develop — это артефакты мержа
        if (mainBranches.has(branch)) return false;
        return true;
      })
      .map(([key, events]) => {
        const [projectId, ...branchParts] = key.split('_');
        return {
          projectId: parseInt(projectId, 10),
          branch: branchParts.join('_'),
          events: this.cleanEvents(events, date),
        };
      });
  }

  //очищает события от лишних данных и фильтрует за указанный день
  private cleanEvents(events: GitLabEvent[], date: string): CleanEvent[] {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return events
      .filter((event) => {
        const eventDate = new Date(event.created_at);
        return eventDate >= dayStart && eventDate <= dayEnd;
      })
      .map((event) => ({
        id: event.id,
        projectId: event.project_id,
        actionName: event.action_name,
        targetType: event.target_type,
        targetTitle: event.target_title,
        createdAt: event.created_at,
        pushData: event.push_data
          ? {
              commitCount: event.push_data.commit_count,
              action: event.push_data.action,
              refType: event.push_data.ref_type,
              ref: event.push_data.ref,
              commitTitle: event.push_data.commit_title,
            }
          : undefined,
        noteBody: event.note?.body,
      }));
  }

  //очищает комментарии и фильтрует за указанный день
  private cleanNotes(notes: GitLabNote[], date: string): CleanNote[] {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return notes
      .filter((note) => {
        const noteDate = new Date(note.created_at);
        return noteDate >= dayStart && noteDate <= dayEnd;
      })
      .map((note) => ({
        id: note.id,
        body: note.body,
        authorUsername: note.author.username,
        authorName: note.author.name,
        createdAt: note.created_at,
        system: note.system,
        noteableType: note.noteable_type,
        resolvable: note.resolvable,
        resolved: note.resolved,
      }));
  }

  //очищает события лейблов и фильтрует за указанный день
  private cleanLabelEvents(
    labelEvents: GitLabLabelEvent[],
    date: string,
  ): CleanLabelEvent[] {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return labelEvents
      .filter((event) => {
        const eventDate = new Date(event.created_at);
        return eventDate >= dayStart && eventDate <= dayEnd;
      })
      .map((event) => ({
        id: event.id,
        labelName: event.label.name,
        action: event.action,
        createdAt: event.created_at,
        username: event.user.username,
      }));
  }
}
